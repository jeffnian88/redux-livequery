"use strict";
import update from 'immutability-helper';
let store = void 0;
const Rx = require('rxjs/Rx');
let queries = [];
let queryIDMap = {};
export function runLivequery() {
  queries.forEach((each) => {
    each(store);
  });
}
export function combineLivequery(...queryArray) {
  queryArray.forEach((each) => {
    queries.push(each);
  });
}


function makeCheckFuncWithSelector(selector, cb) {
  let currentValue = null;
  let previousValue = null;

  // Try to get first value since the checkFun only be invoked whenever state tree change.
  currentValue = selector(store.getState());
  if (currentValue) {
    cb(currentValue, previousValue);
  }

  return () => {
    previousValue = currentValue;
    currentValue = selector(store.getState());
    if (previousValue !== currentValue) {
      cb(currentValue, previousValue);
    }
  };
}

// TODO: use Singleton Observable that can improve performance if selector function is the same path
let rxStateIDMapObservable = {};

let queryIDMapRxStates = {};
function createRxStateBySelector(selector, field, key, queryID) {
  let rxStateID = `${field}_${key}_${queryID}`;
  //if (rxStateIDMapObservable[rxStateID]) {
  if (queryIDMapRxStates[queryID] && queryIDMapRxStates[queryID][rxStateID]) {
    console.error("Shouldn't happen.", rxStateID, queryIDMapRxStates[queryID]);
    //return rxStateIDMapObservable[rxStateID];
  }
  return rxStateIDMapObservable[rxStateID] = Rx.Observable.create((subscriber) => {
    //console.log(`subscribe():${rxStateID}`);
    let func = makeCheckFuncWithSelector(selector, (nextValue, lastValue) => {
      let val = { nextValue, lastValue, field, key };
      //console.log(`trigger next =>`, val);
      subscriber.next(val);
    });
    let unsub = store.subscribe(func);
    queryIDMapRxStates[queryID] = Object.assign({}, queryIDMapRxStates[queryID], { [rxStateID]: { subscriber, unsub } });
    //console.log(`queryIDMapRxStates[${queryID}]:`, queryIDMapRxStates[queryID]);
  });
};
function destroyRxStateByIndex(field, key, queryID) {
  let rxStateID = `${field}_${key}_${queryID}`;
  if (queryIDMapRxStates[queryID] && queryIDMapRxStates[queryID][rxStateID]) {
    //console.log(`unsubscribe():${rxStateID}`);
    let { unsub, subscriber } = queryIDMapRxStates[queryID][rxStateID];
    subscriber.complete();
    unsub();
    delete queryIDMapRxStates[queryID][rxStateID];
    delete rxStateIDMapObservable[rxStateID];
  } else {
    console.error("Shouldn't happen.", rxStateID, queryIDMapRxStates[queryID]);
    return null;
  }
}
function unsubscribeRxQuery(queryID) {
  if (queryIDMapRxStates[queryID]) {
    //console.log(`unsubscribeRxQuery():${queryID}`);
    Object.keys(queryIDMapRxStates[queryID]).forEach((key) => {
      let { unsub, subscriber } = queryIDMapRxStates[queryID][key];
      subscriber.complete();
      unsub();
      delete queryIDMapRxStates[queryID][key];
    });
    delete queryIDMapRxStates[queryID];
    // if success
    return true;
  }
  // if fail
  return false;
}
export function livequeryEnhancer() {
  return function (createStore) {
    return function (reducer, preloadedState, enhancer) {
      store = createStore(reducer, preloadedState, enhancer);

      // do whatever you want with store object

      return store;
    };
  };
}

export function rxQueryLeftJoin(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  let queryID = getUniqueQueryID();

  let unsub = () => unsubscribeRxQuery(queryID);
  let field0 = fieldArray[0];
  let newSelectorArray = [];
  for (let i = 1; i < selectorArray.length; i++) {
    newSelectorArray[i] = (uid) => (state) => selectorArray[i](state)[uid];
  }

  let list = [];
  let keyMapIndex = {};
  createRxStateBySelector(selectorArray[0], field0, 0, queryID)
    .mergeMap(val => {
      //console.log("mergeMap() val:", val);
      let arrayObserable = [];
      let { nextValue, lastValue, field, key } = val;

      let passObserable = Rx.Observable.of(val);
      arrayObserable.push(passObserable);

      let { deletedObjectKeys, addedObjectkeys, andObjectKeys } = getRelObjectKeys(nextValue, lastValue);
      Object.keys(deletedObjectKeys).forEach((key) => {
        for (let i = 1; i < fieldArray.length; i++) {
          destroyRxStateByIndex(fieldArray[i], key, queryID);
        }
      });

      Object.keys(addedObjectkeys).forEach((key) => {
        for (let i = 1; i < fieldArray.length; i++) {
          let obserable = createRxStateBySelector(newSelectorArray[i](key), fieldArray[i], key, queryID);
          arrayObserable.push(obserable);
        }
      });

      return Rx.Observable.merge(...arrayObserable);
    }).map(val => {
      //console.log("map() val:", val);
      let { nextValue, lastValue, key, field } = val;

      if (field === field0) {

        let { deletedObjectKeys, addedObjectkeys, andObjectKeys } = getRelObjectKeys(nextValue, lastValue);

        Object.keys(deletedObjectKeys).forEach((key) => {
          let index = findIndexWrapper(list, key, keyMapIndex);
          //console.log(`${key} delete index:`, index);
          if (index >= 0) {
            // delete element
            list = deleteListWrapper(list, index, keyMapIndex);
            //console.log('del:', key, index, list);
          } else {
            console.error("Impossible!!");
          }
        });
        Object.keys(addedObjectkeys).forEach((key) => {
          let index = findIndexWrapper(list, key, keyMapIndex);
          //console.log(`${key} add index:`, index);
          if (index >= 0) {
            console.error("Impossible!!");
          } else {
            // add element
            list = pushListWrapper(list, { [field0]: nextValue[key] }, key, keyMapIndex);
          }
        });

        Object.keys(andObjectKeys).forEach((key) => {
          if (nextValue[key] !== lastValue[key]) {
            let index = findIndexWrapper(list, key, keyMapIndex);
            if (index >= 0) {
              // modify element
              //console.log("modify index:", index);
              list = updateListWrapper(list, index, field0, nextValue[key]);
            } else {
              console.error("Impossible!!");
            }
          }
        });
      } else {
        // field is other 
        let index = findIndexWrapper(list, key, keyMapIndex);
        if (index >= 0) {
          // modify element
          //console.log("modify index:", index);
          list = updateListWrapper(list, index, field, nextValue);
        } else {
          // shouldn't happen?
          list = pushListWrapper(list, { [field]: nextValue }, key, keyMapIndex);
        }
      }
      return list;
    })
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
};
export const rxQueryBasedOnObjectKeys = rxQueryLeftJoin;
export function rxQueryInnerJoin(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  let queryID = getUniqueQueryID();
  let unsub = () => unsubscribeRxQuery(queryID);

  let newSelectorArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    newSelectorArray[i] = (key) => (state) => selectorArray[i](state)[key];
  }

  let list = [];
  let keyMapIndex = {};

  let indexMapObjectKeys = {};
  const lenSelector = selectorArray.length;
  let lastInterObjectKeys = [];

  let rootObserable = [];
  for (let i = 0; i < selectorArray.length; i++) {
    let fieldName = fieldArray[i];
    rootObserable.push(createRxStateBySelector(selectorArray[i], `${fieldName}_ObjectKeysChange`, i, queryID));
  }
  Rx.Observable.merge(...rootObserable)
    .mergeMap((val) => {
      //console.log(`rxQueryInnerJoin => ${queryID}:`, " mergeMap() val:", val);
      let { lastValue, nextValue, field, key } = val;

      // update each the child key set of Object that selected by each selector
      if (nextValue) {
        let { andObjectKeys } = getRelObjectKeys(nextValue, lastValue);
        if ((Object.keys(andObjectKeys).length === Object.keys(lastValue || {}).length) &&
          (Object.keys(andObjectKeys).length === Object.keys(nextValue).length)
        ) {
          //console.log(`${field}: NO change checked.`);
          return Rx.Observable.empty();
        } else {
          indexMapObjectKeys[key] = nextValue;
        }
      } else {
        // if nextValue is null or undefined
        if (indexMapObjectKeys[key]) {
          delete indexMapObjectKeys[key];
        }
      }

      let arrayObserable = [Rx.Observable.empty()];
      // Check if we get all child key set of each Object selected by selector is set.
      if (lenSelector === Object.keys(indexMapObjectKeys).length) {

        //TODO: improve here
        let nextInterObjectKeys = indexMapObjectKeys[0];
        for (let i = 1; i < lenSelector; i++) {
          let { andObjectKeys } = getRelObjectKeys(nextInterObjectKeys, indexMapObjectKeys[i]);
          nextInterObjectKeys = andObjectKeys;
        }

        let { deletedObjectKeys, addedObjectkeys, andObjectKeys } = getRelObjectKeys(nextInterObjectKeys, lastInterObjectKeys);
        //console.log(`rxQueryInnerJoin => ${queryID}: nextInterObjectKeys:`, nextInterObjectKeys, `lastInterObjectKeys:`, lastInterObjectKeys);

        if (Object.keys(deletedObjectKeys).length !== 0) {
          // we put all data operation into next stage
          arrayObserable.push(Rx.Observable.of({
            nextValue: nextInterObjectKeys,
            lastValue: lastInterObjectKeys,
            field: `interObjectKeysChange_${queryID}`,
            key
          }));
        }
        lastInterObjectKeys = nextInterObjectKeys;
        Object.keys(deletedObjectKeys).forEach((key) => {
          for (let i = 0; i < lenSelector; i++) {
            destroyRxStateByIndex(fieldArray[i], key, queryID);
          }
        });
        Object.keys(addedObjectkeys).forEach((key) => {
          for (let i = 0; i < lenSelector; i++) {
            let obserable = createRxStateBySelector(newSelectorArray[i](key), fieldArray[i], key, queryID);
            if (obserable) {
              arrayObserable.push(obserable);
            }
          }
        });
      }
      return Rx.Observable.merge(...arrayObserable);
    })
    .map((val) => {
      //console.log("map() val:", val);
      let { nextValue, lastValue, field, key } = val;
      if (field === `interObjectKeysChange_${queryID}`) {
        let { deletedObjectKeys, addedObjectkeys, andObjectKeys } = getRelObjectKeys(nextValue, lastValue);

        Object.keys(deletedObjectKeys).forEach((key) => {
          let index = findIndexWrapper(list, key, keyMapIndex);
          //console.log(`${key} delete index:`, index);
          if (index >= 0) {
            // delete element
            list = deleteListWrapper(list, index, keyMapIndex);
            //console.log('del:', key, index, list);
          } else {
            console.error("Impossible!!");
          }
        });

      } else {
        // field is other 
        let index = findIndexWrapper(list, key, keyMapIndex);
        if (index >= 0) {
          // modify element
          //console.log("modify index:", index);
          list = updateListWrapper(list, index, field, nextValue);
        } else {
          if (key in lastInterObjectKeys) {
            list = pushListWrapper(list, { [field]: nextValue }, key, keyMapIndex);
          }
        }
      }
      return list;
    })
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
}

function getRelObjectKeys(nextValue = {}, lastValue = {}) {
  let addedObjectkeys = {};   // next - last
  let andObjectKeys = {};     // next & last
  let deletedObjectKeys = {}; // last - next
  if (lastValue) {
    Object.keys(lastValue).filter((key) => (!(nextValue && (key in nextValue)))).map((key) => {
      deletedObjectKeys[key] = true;
    });
  }
  if (nextValue) {
    Object.keys(nextValue).filter((key) => (!(lastValue && (key in lastValue)))).map((key) => {
      addedObjectkeys[key] = true;
    });
  }
  Object.keys(nextValue).filter((key) => (lastValue && (key in lastValue))).map((key) => {
    andObjectKeys[key] = true;
  });
  //console.log(`getRelObjectKeys():`, { deletedObjectKeys, addedObjectkeys, andObjectKeys });
  return { deletedObjectKeys, addedObjectkeys, andObjectKeys };
}

export function rxQuerySimple(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  let queryID = getUniqueQueryID();
  let unsub = () => unsubscribeRxQuery(queryID);
  let resultObject = {};

  let rootObserableArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    rootObserableArray.push(createRxStateBySelector(selectorArray[i], fieldArray[i], i, queryID));
  }
  Rx.Observable.merge(...rootObserableArray)
    .map((val) => {
      //console.log("map() val:", val);
      let { nextValue, lastValue, field, key } = val;
      resultObject = update(resultObject, { [field]: { $set: nextValue } });
      return resultObject;
    })
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
}

export function rxQueryFullOuterJoin(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  let queryID = getUniqueQueryID();
  let unsub = () => unsubscribeRxQuery(queryID);

  let newSelectorArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    newSelectorArray[i] = (key) => (state) => selectorArray[i](state)[key];
  }

  let list = [];
  let keyMapIndex = {};

  let indexMapObjectKeys = {};
  const lenSelector = selectorArray.length;
  let lastOuterObjectKeys = [];

  let rootObserable = [];
  for (let i = 0; i < selectorArray.length; i++) {
    let fieldName = fieldArray[i];
    rootObserable.push(createRxStateBySelector(selectorArray[i], `${fieldName}_ObjectKeysChange`, i, queryID));
  }
  Rx.Observable.merge(...rootObserable)
    .mergeMap((val) => {
      //console.log(`rxQueryOuterJoin => ${queryID}:`, " mergeMap() val:", val);
      let { lastValue, nextValue, field, key } = val;

      // update each the child key set of Object that selected by each selector
      if (nextValue) {
        let { andObjectKeys } = getRelObjectKeys(nextValue, lastValue);
        if ((Object.keys(andObjectKeys).length === Object.keys(lastValue || {}).length) &&
          (Object.keys(andObjectKeys).length === Object.keys(nextValue).length)
        ) {
          //console.log(`${field}: NO change checked.`);
          return Rx.Observable.empty();
        } else {
          indexMapObjectKeys[key] = nextValue;
        }
      } else {
        // if nextValue is null or undefined
        if (indexMapObjectKeys[key]) {
          delete indexMapObjectKeys[key];
        }
      }

      let arrayObserable = [Rx.Observable.empty()];
      // Check if we get all child key set of each Object selected by selector is set.
      if (Object.keys(indexMapObjectKeys).length > 0) {

        //TODO: improve here
        let nextOuterObjectKeys = indexMapObjectKeys[0];
        for (let i = 1; i < lenSelector; i++) {
          let { addedObjectkeys } = getRelObjectKeys(indexMapObjectKeys[i], nextOuterObjectKeys);
          nextOuterObjectKeys = Object.assign({}, nextOuterObjectKeys, addedObjectkeys);
        }
        //console.log("nextOuterObjectKeys:", nextOuterObjectKeys, ", lastOuterObjectKeys:", lastOuterObjectKeys);

        let { deletedObjectKeys, addedObjectkeys, andObjectKeys } = getRelObjectKeys(nextOuterObjectKeys, lastOuterObjectKeys);

        if (Object.keys(deletedObjectKeys).length !== 0) {

          // we put all data operation into next stage
          arrayObserable.push(Rx.Observable.of({
            nextValue: nextOuterObjectKeys,
            lastValue: lastOuterObjectKeys,
            field: `OuterObjectKeysChange_${queryID}`,
            key
          }));
        }
        lastOuterObjectKeys = nextOuterObjectKeys;
        Object.keys(deletedObjectKeys).forEach((key) => {
          for (let i = 0; i < lenSelector; i++) {
            destroyRxStateByIndex(fieldArray[i], key, queryID);
          }
        });
        Object.keys(addedObjectkeys).forEach((key) => {
          for (let i = 0; i < lenSelector; i++) {
            let obserable = createRxStateBySelector(newSelectorArray[i](key), fieldArray[i], key, queryID);
            if (obserable) {
              arrayObserable.push(obserable);
            }
          }
        });
      }
      return Rx.Observable.merge(...arrayObserable);
    })
    .map((val) => {
      //console.log("map() val:", val);
      let { nextValue, lastValue, field, key } = val;
      if (field === `OuterObjectKeysChange_${queryID}`) {
        let { deletedObjectKeys, addedObjectkeys, andObjectKeys } = getRelObjectKeys(nextValue, lastValue);

        Object.keys(deletedObjectKeys).forEach((key) => {
          let index = findIndexWrapper(list, key, keyMapIndex);
          //console.log(`${key} delete index:`, index);
          if (index >= 0) {
            // delete element
            list = deleteListWrapper(list, index, keyMapIndex);
            //console.log('del:', key, index, list);
          } else {
            console.error("Impossible!!");
          }
        });

      } else {
        // field is other 
        let index = findIndexWrapper(list, key, keyMapIndex);
        if (index >= 0) {
          // modify element
          //console.log("modify index:", index);
          list = updateListWrapper(list, index, field, nextValue);
        } else {
          if (key in lastOuterObjectKeys) {
            list = pushListWrapper(list, { [field]: nextValue }, key, keyMapIndex);
          }
        }
      }
      return list;
    })
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
}


function getNextKeyMapIndex(list, key, keyMapIndex) {
  if (key in keyMapIndex) {
    //let nextKeyMapIndex = Object.assign({}, keyMapIndex);
    let nextKeyMapIndex = keyMapIndex;
    let index = keyMapIndex[key];
    for (let i = index + 1; i < list.length; i++) {
      let key = list[i].key;
      nextKeyMapIndex[key] = nextKeyMapIndex[key] - 1;
    }
    delete nextKeyMapIndex[key];
    return nextKeyMapIndex;
  }
  return null;

}
function improvedFindIndexByKey(list, key, keyMapIndex) {
  if (key in keyMapIndex) {
    return keyMapIndex[key];
  } else {
    return -1;
  }
}
// Find Index By Key
function findIndexWrapper(list, key, keyMapIndex) {
  //let index = improvedFindIndexByKey(list, key, keyMapIndex);
  // old way to find index 
  let index = list.findIndex((each) => key === each.key);

  if (index !== improvedFindIndexByKey(list, key, keyMapIndex)) {
    console.log('improvedFindIndexByKey() not equal to findIndex().');
  }
  return index;
}
// Create
function pushListWrapper(list, data, key, keyMapIndex) {
  keyMapIndex[key] = list.length;
  return update(list, { $push: [Object.assign({}, data, { key })] });
}
// Update
function updateListWrapper(list, index, field, data) {
  return update(list, { [index]: { [field]: { $set: data } } });
}
// Delete
function deleteListWrapper(list, index, keyMapIndex) {
  //function getNextKeyMapIndex(keyMapIndex, key, list) {
  keyMapIndex = getNextKeyMapIndex(list, list[index].key, keyMapIndex);
  if (keyMapIndex === null) console.log('List is inconsistent with keyMapIndex');
  return update(list, { $splice: [[index, 1]] });
}

function getUniqueQueryID() {
  let queryID, i = 0;
  while ((queryID = Date.now() + i) in queryIDMap) { i++; }
  queryIDMap[queryID] = true;
  return queryID;
}