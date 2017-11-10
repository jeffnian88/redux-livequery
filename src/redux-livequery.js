"use strict";
import update from 'immutability-helper';
let store = void 0;
const Rx = require('rxjs/Rx');

let queryIDMap = {};

const cl = function () { };
//const cl = console.log;

let queries = [];
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
//the fun above will be deprecated


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
    cl('selector:', selector)
    cl('previousValue:', previousValue);
    cl('currentValue:', currentValue);
    if (previousValue !== currentValue) {
      cb(currentValue, previousValue);
    }
  };
}


let rxStateIDMapObservable = {};
// The reason of TODO: Try to reduce the call to store.subscribe (minimize the number of subscriber)
// TODO: If use Singleton Observable for RxState created by selector and key
// , then we can improve performance if the both selector function and key of RxState are the same
// Implementation Tips:
// 1. reference count for each RxState
// 2. If new query need the same RxState, immediately return RxState Observable, reference count plus one
// 3. If destroy RxState Observable, reference count minus one
// TODO here:
// getReferenceCountForRxState(selector, key)
// addReferenceCountForRxState(selector, key)
// delReferenceCountForRxState(selector, key)
// getObservableOfRxState(selector,key) return null if non-exist, return Observable if exists
// createRxStateBySelector, create one if getObservableOfRxState return null
//                          return Observable if getObservableOfRxState return Observable
let queryIDMapRxStates = {};
function createRxStateBySelector(selector, field, key, queryID) {
  const rxStateID = `${field}_${key}_${queryID}`;
  //if (rxStateIDMapObservable[rxStateID]) {
  if (queryIDMapRxStates[queryID] && queryIDMapRxStates[queryID][rxStateID]) {
    console.error("Shouldn't happen.", rxStateID, queryIDMapRxStates[queryID]);
    return true;
    //return rxStateIDMapObservable[rxStateID];
  }
  return rxStateIDMapObservable[rxStateID] = Rx.Observable.create((subscriber) => {
    //cl(`subscribe():${rxStateID}`);
    const func = makeCheckFuncWithSelector(selector, (nextValue, lastValue) => {
      const val = { nextValue, lastValue, field, key };
      ////cl(`trigger next =>`, val);
      subscriber.next(val);
    });
    const unsub = store.subscribe(func);
    if (!queryIDMapRxStates[queryID]) queryIDMapRxStates[queryID] = {};
    queryIDMapRxStates[queryID][rxStateID] = { subscriber, unsub };
    //queryIDMapRxStates[queryID] = Object.assign({}, queryIDMapRxStates[queryID], { [rxStateID]: { subscriber, unsub } });
    ////cl(`queryIDMapRxStates[${queryID}]:`, queryIDMapRxStates[queryID]);
  });
};
// destroy Observable if getReferenceCountForRxState(selector, key) is zero
// minus one reference count if otherwise 
// TODO here:
// tryDestroyRxStateObservable(selector, key, field, queryID)

function destroyRxStateByIndex(field, key, queryID) {
  const rxStateID = `${field}_${key}_${queryID}`;
  if (queryIDMapRxStates[queryID] && queryIDMapRxStates[queryID][rxStateID]) {
    ////cl(`unsubscribe():${rxStateID}`);
    const { unsub, subscriber } = queryIDMapRxStates[queryID][rxStateID];
    unsub();
    subscriber.complete();
    delete queryIDMapRxStates[queryID][rxStateID];
    delete rxStateIDMapObservable[rxStateID];
  } else {
    console.error("Shouldn't happen.", rxStateID, queryIDMapRxStates[queryID]);
    console.error('Please submit the issue to https://goo.gl/m88nJV');
    return null;
  }
}
// try to destroy each RxState Observable in RxQuery
function unsubscribeRxQuery(queryID) {
  if (queryIDMapRxStates[queryID]) {
    ////cl(`unsubscribeRxQuery():${queryID}`);
    for (const key in queryIDMapRxStates[queryID]) {
      const { unsub, subscriber } = queryIDMapRxStates[queryID][key];
      subscriber.complete();
      unsub();
      //delete queryIDMapRxStates[queryID][key];
    }
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


function getRelObjectKeys(leftValue = {}, rightValue = {}) {
  let leftObjectKeys = {};   // next - last
  let innerObjectKeys = {};  // next & last
  let rightObjectKeys = {};  // last - next
  if (!leftValue) leftValue = {};
  if (!rightValue) rightValue = {};
  for (const key in leftValue) {
    if (key in rightValue) {
      innerObjectKeys[key] = true;
    } else {
      leftObjectKeys[key] = true;
    }
  }
  for (const key in rightValue) {
    if (!(key in leftValue)) {
      rightObjectKeys[key] = true;
    }
  }
  //cl(`getRelObjectKeys():`, { leftObjectKeys, innerObjectKeys, rightObjectKeys });
  return { leftObjectKeys, innerObjectKeys, rightObjectKeys };
}

// TODO here: improve here to find index by key
function getNextKeyMapIndex(list, key, keyMapIndex = {}) {
  if (!!keyMapIndex && (key in keyMapIndex)) {
    //let nextKeyMapIndex = keyMapIndex;
    //let nextKeyMapIndex = _.cloneDeep(keyMapIndex);
    let nextKeyMapIndex = { ...keyMapIndex };
    const index = keyMapIndex[key];
    for (let i = index + 1; i < list.length; i++) {
      const key = list[i].key;
      nextKeyMapIndex[key] = nextKeyMapIndex[key] - 1;
    }
    delete nextKeyMapIndex[key];
    return nextKeyMapIndex;
  }
  return null;
}

function improvedFindIndexByKey(list, key, keyMapIndex = {}) {
  if (keyMapIndex && (key in keyMapIndex)) {
    return keyMapIndex[key];
  } else {
    return -1;
  }
}
// Find Index By Key
function findIndexWrapper(list, key, keyMapIndex) {
  //let index = improvedFindIndexByKey(list, key, keyMapIndex);
  // old way to find index 
  // use traditional search methid
  const index = list.findIndex((each) => key === each.key);

  // disable improve search index by key
  // TODO: try to enable here
  if (index !== improvedFindIndexByKey(list, key, keyMapIndex)) {
    console.warn('improvedFindIndexByKey() not equal to findIndex(). Please submit the issue to https://goo.gl/m88nJV');
  }
  return index;
}
// Create
function pushListWrapper(list, data, key, keyMapIndex) {
  keyMapIndex[key] = list.length;
  return update(list, { $push: [Object.assign({}, data, { key })] });
}
// Update
function updateListWrapper(list, index, field, nextValue) {
  if (list[index][field] !== nextValue) {
    return update(list, { [index]: { [field]: { $set: nextValue } } });
  } else {
    return list;
  }
}
// Delete
function deleteListWrapper(list, index, keyMapIndex) {
  keyMapIndex = getNextKeyMapIndex(list, list[index].key, keyMapIndex);
  if (keyMapIndex === null) {
    console.error('impossible: List is inconsistent to keyMapIndex.');
    console.error('Please submit the issue to https://goo.gl/m88nJV');
  }
  return update(list, { $splice: [[index, 1]] });
}

function getUniqueQueryID() {
  let queryID, i = 0;
  while ((queryID = Date.now() + i) in queryIDMap) { i++; }
  queryIDMap[queryID] = true;
  return queryID;
}

export function rxQuerySimple(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  const queryID = getUniqueQueryID();
  const unsub = () => unsubscribeRxQuery(queryID);
  let resultObject = {};

  let rootObserableArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    rootObserableArray.push(createRxStateBySelector(selectorArray[i], fieldArray[i], i, queryID));
  }
  Rx.Observable.merge(...rootObserableArray)
    .map((val) => {
      const { nextValue, lastValue, field, key } = val;
      return update(resultObject, { [field]: { $set: nextValue } });
    })
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
}

const commonListOperation = (list, keyMapIndex, queryID) => (val) => {
  //cl("map() val:", val);
  const { nextValue, lastValue, field, key } = val;
  if (field === `resultObjectKeysChange_${queryID}`) {
    // Object Keys Change
    const { rightObjectKeys } = getRelObjectKeys(nextValue, lastValue);
    for (const key in rightObjectKeys) {
      const index = findIndexWrapper(list, key, keyMapIndex);
      ////cl(`${key} delete index:`, index);
      if (index >= 0) {
        // delete element
        list = deleteListWrapper(list, index, keyMapIndex);
        ////cl('del:', key, index, list);
      } else {
        console.error("Impossible: Can't find index.");
        console.warn('Please submit the issue to https://goo.gl/m88nJV');
      }
    }
  } else {
    // field was changed 
    const index = findIndexWrapper(list, key, keyMapIndex);
    if (index >= 0) {
      // modify element
      ////cl("modify index:", index);
      list = updateListWrapper(list, index, field, nextValue);
    } else {
      list = pushListWrapper(list, { [field]: nextValue }, key, keyMapIndex);
    }
  }
  return list;
};

const makeChildKeySelectorBySelector = (selector) => (key) => (state) => {
  const object = selector(state);
  if (object) {
    if (typeof object === 'object')
      return object[key];
    else {
      console.warn('The value selected by selector should be object.');
      return;
    }
  } else {
    return object;
  }
};

export function rxQueryInnerJoin(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  const queryID = getUniqueQueryID();
  const unsub = () => unsubscribeRxQuery(queryID);

  let childKeySelectorArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    //childKeySelectorArray[i] = (key) => (state) => selectorArray[i](state)[key];
    childKeySelectorArray[i] = makeChildKeySelectorBySelector(selectorArray[i]);
  }

  let list = [];
  let keyMapIndex = {};

  let indexMapObjectKeys = {};
  const lenSelector = selectorArray.length;
  let lastResultObjectKeys = [];

  let rootObserable = [];
  for (let i = 0; i < selectorArray.length; i++) {
    const fieldName = fieldArray[i];
    rootObserable.push(createRxStateBySelector(selectorArray[i], `${fieldName}_ObjectKeysChange`, i, queryID));
  }
  Rx.Observable.merge(...rootObserable)
    .mergeMap((val) => {
      ////cl(`rxQueryInnerJoin => ${queryID}:`, " mergeMap() val:", val);
      const { lastValue, nextValue, field, key } = val;

      // update each the child key set of Object that selected by each selector
      if (nextValue) {
        const { innerObjectKeys } = getRelObjectKeys(nextValue, lastValue);
        if ((Object.keys(innerObjectKeys).length === Object.keys(lastValue || {}).length) &&
          (Object.keys(innerObjectKeys).length === Object.keys(nextValue).length)
        ) {
          //cl(`${field}: NO change checked.`);
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
      if (lenSelector !== Object.keys(indexMapObjectKeys).length) {
        return Rx.Observable.merge(...arrayObserable);
      }

      //TODO: any improvement here?
      let nextResultObjectKeys = indexMapObjectKeys[0];
      for (let i = 1; i < lenSelector; i++) {
        let { innerObjectKeys } = getRelObjectKeys(nextResultObjectKeys, indexMapObjectKeys[i]);
        nextResultObjectKeys = innerObjectKeys;
      }

      //cl(`rxQueryInnerJoin => ${queryID}: nextResultObjectKeys:`, nextResultObjectKeys, `lastResultObjectKeys:`, lastResultObjectKeys);
      const { leftObjectKeys, innerObjectKeys, rightObjectKeys } = getRelObjectKeys(nextResultObjectKeys, lastResultObjectKeys);

      if (Object.keys(rightObjectKeys).length !== 0) {
        // we put all data operation into next stage
        arrayObserable.push(Rx.Observable.of({
          nextValue: nextResultObjectKeys,
          lastValue: lastResultObjectKeys,
          field: `resultObjectKeysChange_${queryID}`,
          key
        }));
      }
      //TODO: any improvement here?
      lastResultObjectKeys = nextResultObjectKeys;
      for (const key in rightObjectKeys) {
        for (let i = 0; i < lenSelector; i++) {
          destroyRxStateByIndex(fieldArray[i], key, queryID);
        }
      }
      for (const key in leftObjectKeys) {
        for (let i = 0; i < lenSelector; i++) {
          const obserable = createRxStateBySelector(childKeySelectorArray[i](key), fieldArray[i], key, queryID);
          if (obserable) {
            arrayObserable.push(obserable);
          }
        }
      }
      return Rx.Observable.merge(...arrayObserable);
    })
    .map(commonListOperation(list, keyMapIndex, queryID))
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
}
export function rxQueryLeftJoin(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  const queryID = getUniqueQueryID();
  const unsub = () => unsubscribeRxQuery(queryID);

  let childKeySelectorArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    //childKeySelectorArray[i] = (key) => (state) => selectorArray[i](state)[key];
    childKeySelectorArray[i] = makeChildKeySelectorBySelector(selectorArray[i]);
  }

  let list = [];
  let keyMapIndex = {};

  let indexMapObjectKeys = {};
  const lenSelector = selectorArray.length;
  let lastResultObjectKeys = [];

  let lastVal = null;
  // initial list
  const object = selectorArray[0](store.getState()) || {};
  for (const key in object) {
    let data = { key };
    for (let i = 0; i < lenSelector; i++) {
      const fieldObject = selectorArray[i](store.getState());
      const fieldName = fieldArray[i];
      data[fieldName] = !!fieldObject && (typeof fieldObject === 'object') ? fieldObject[key] : null;
    }
    keyMapIndex[key] = list.length;
    list = update(list, { $push: [data] });
  }
  lastVal = list;
  setImmediate(resultFun, list);


  let rootObserable = [];
  const fieldName = fieldArray[0];
  rootObserable.push(createRxStateBySelector(selectorArray[0], `${fieldName}_ObjectKeysChange`, 0, queryID));
  Rx.Observable.merge(...rootObserable)
    .mergeMap((val) => {
      //cl(`rxQueryLeftJoin => ${queryID}:`, " mergeMap() val:", val);
      const { lastValue, nextValue, field, key } = val;

      // update each the child key set of Object that selected by each selector
      if (nextValue) {
        const { innerObjectKeys } = getRelObjectKeys(nextValue, lastValue);
        if ((Object.keys(innerObjectKeys).length === Object.keys(lastValue || {}).length) &&
          (Object.keys(innerObjectKeys).length === Object.keys(nextValue).length)
        ) {
          //cl(`${field}: NO change checked.`);
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

      const { innerObjectKeys: nextResultObjectKeys } = getRelObjectKeys(indexMapObjectKeys[0], indexMapObjectKeys[0]);

      //cl(`rxQueryLeftJoin => ${queryID}: nextResultObjectKeys:`, nextResultObjectKeys, `lastResultObjectKeys:`, lastResultObjectKeys);
      const { leftObjectKeys, innerObjectKeys, rightObjectKeys } = getRelObjectKeys(nextResultObjectKeys, lastResultObjectKeys);

      if (Object.keys(rightObjectKeys).length !== 0) {
        // we put all data operation into next stage
        arrayObserable.push(Rx.Observable.of({
          nextValue: nextResultObjectKeys,
          lastValue: lastResultObjectKeys,
          field: `resultObjectKeysChange_${queryID}`,
          key
        }));
      }
      lastResultObjectKeys = nextResultObjectKeys;
      // TODO: any improvement here?
      for (const key in rightObjectKeys) {
        for (let i = 0; i < lenSelector; i++) {
          destroyRxStateByIndex(fieldArray[i], key, queryID);
        }
      }
      for (const key in leftObjectKeys) {
        for (let i = 0; i < lenSelector; i++) {
          const obserable = createRxStateBySelector(childKeySelectorArray[i](key), fieldArray[i], key, queryID);
          if (obserable) {
            arrayObserable.push(obserable);
          }
        }
      }
      return Rx.Observable.merge(...arrayObserable);
    })
    .map(commonListOperation(list, keyMapIndex, queryID))
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        if (val !== lastVal) {
          lastVal = val;
          resultFun(val);
        }
      }
    });

  return unsub;
}
export function rxQuerySingleObject(selector, fieldName, resultFun, debounceTime = 0) {
  // sanity-check
  const queryID = getUniqueQueryID();
  const unsub = () => unsubscribeRxQuery(queryID);

  const childKeySelector = makeChildKeySelectorBySelector(selector);

  let indexMapObjectKeys = {};
  let lastResultObjectKeys = [];

  let list = [];
  let keyMapIndex = {};
  let lastVal = null;
  // initial list
  const object = selector(store.getState()) || {};
  for (const key in object) {
    keyMapIndex[key] = list.length;
    list = update(list, { $push: [{ key: key, [fieldName]: object[key] }] });
  }
  lastVal = list;
  setImmediate(resultFun, list);


  let rootObserable = [];
  rootObserable.push(createRxStateBySelector(selector, `${fieldName}_ObjectKeysChange`, 0, queryID));
  Rx.Observable.merge(...rootObserable)
    .mergeMap((val) => {
      //cl(`rxQueryLeftJoin => ${queryID}:`, " mergeMap() val:", val);
      const { lastValue, nextValue, field, key } = val;

      // update each the child key set of Object that selected by each selector
      if (nextValue) {
        const { innerObjectKeys } = getRelObjectKeys(nextValue, lastValue);
        if ((Object.keys(innerObjectKeys).length === Object.keys(lastValue || {}).length) &&
          (Object.keys(innerObjectKeys).length === Object.keys(nextValue).length)
        ) {
          //cl(`${field}: NO change checked.`);
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

      const { innerObjectKeys: nextResultObjectKeys } = getRelObjectKeys(indexMapObjectKeys[0], indexMapObjectKeys[0]);

      //cl(`rxQueryLeftJoin => ${queryID}: nextResultObjectKeys:`, nextResultObjectKeys, `lastResultObjectKeys:`, lastResultObjectKeys);
      const { leftObjectKeys, innerObjectKeys, rightObjectKeys } = getRelObjectKeys(nextResultObjectKeys, lastResultObjectKeys);

      if (Object.keys(rightObjectKeys).length !== 0) {
        // we put all data operation into next stage
        arrayObserable.push(Rx.Observable.of({
          nextValue: nextResultObjectKeys,
          lastValue: lastResultObjectKeys,
          field: `resultObjectKeysChange_${queryID}`,
          key
        }));
      }
      lastResultObjectKeys = nextResultObjectKeys;
      // TODO: any improvement here?
      for (const key in rightObjectKeys) {
        destroyRxStateByIndex(fieldName, key, queryID);
      }
      for (const key in leftObjectKeys) {
        const obserable = createRxStateBySelector(childKeySelector(key), fieldName, key, queryID);
        if (obserable) {
          arrayObserable.push(obserable);
        }
      }
      return Rx.Observable.merge(...arrayObserable);
    })
    .map(commonListOperation(list, keyMapIndex, queryID))
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        if (val !== lastVal) {
          lastVal = val;
          resultFun(val);
        }
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

  const queryID = getUniqueQueryID();
  const unsub = () => unsubscribeRxQuery(queryID);

  let childKeySelectorArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    //childKeySelectorArray[i] = (key) => (state) => selectorArray[i](state)[key];
    childKeySelectorArray[i] = makeChildKeySelectorBySelector(selectorArray[i]);
  }

  let list = [];
  let keyMapIndex = {};

  let indexMapObjectKeys = {};
  const lenSelector = selectorArray.length;
  let lastResultObjectKeys = [];

  let rootObserable = [];
  for (let i = 0; i < selectorArray.length; i++) {
    let fieldName = fieldArray[i];
    rootObserable.push(createRxStateBySelector(selectorArray[i], `${fieldName}_ObjectKeysChange`, i, queryID));
  }
  Rx.Observable.merge(...rootObserable)
    .mergeMap((val) => {
      ////cl(`rxQueryFullOuterJoin => ${queryID}:`, " mergeMap() val:", val);
      const { lastValue, nextValue, field, key } = val;

      // update each the child key set of Object that selected by each selector
      if (nextValue) {
        let { innerObjectKeys } = getRelObjectKeys(nextValue, lastValue);
        if ((Object.keys(innerObjectKeys).length === Object.keys(lastValue || {}).length) &&
          (Object.keys(innerObjectKeys).length === Object.keys(nextValue).length)
        ) {
          //cl(`${field}: NO change checked.`);
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
      if (Object.keys(indexMapObjectKeys).length === 0) {
        return Rx.Observable.merge(...arrayObserable);
      }

      let nextResultObjectKeys = indexMapObjectKeys[0];
      for (let i = 1; i < lenSelector; i++) {
        let { leftObjectKeys } = getRelObjectKeys(indexMapObjectKeys[i], nextResultObjectKeys);
        nextResultObjectKeys = Object.assign({}, nextResultObjectKeys, leftObjectKeys);
      }

      //cl(`rxQueryFullOuterJoin => ${queryID}: nextResultObjectKeys:`, nextResultObjectKeys, `lastResultObjectKeys:`, lastResultObjectKeys);
      const { leftObjectKeys, innerObjectKeys, rightObjectKeys } = getRelObjectKeys(nextResultObjectKeys, lastResultObjectKeys);

      if (Object.keys(rightObjectKeys).length !== 0) {
        // we put all data operation into next stage
        arrayObserable.push(Rx.Observable.of({
          nextValue: nextResultObjectKeys,
          lastValue: lastResultObjectKeys,
          field: `resultObjectKeysChange_${queryID}`,
          key
        }));
      }
      // TODO: improve here
      lastResultObjectKeys = nextResultObjectKeys;
      for (const key in rightObjectKeys) {
        for (let i = 0; i < lenSelector; i++) {
          destroyRxStateByIndex(fieldArray[i], key, queryID);
        }
      }
      for (const key in leftObjectKeys) {
        for (let i = 0; i < lenSelector; i++) {
          const obserable = createRxStateBySelector(childKeySelectorArray[i](key), fieldArray[i], key, queryID);
          if (obserable) {
            arrayObserable.push(obserable);
          }
        }
      }
      return Rx.Observable.merge(...arrayObserable);
    })
    .map(commonListOperation(list, keyMapIndex, queryID))
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
}
export function rxQueryLeftOuterJoin(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  // sanity-check
  if (selectorArray.length !== fieldArray.length) {
    console.error('The length of selectorArray did not match the length of fieldArray.');
    return null;
  }

  const queryID = getUniqueQueryID();
  const unsub = () => unsubscribeRxQuery(queryID);

  let childKeySelectorArray = [];
  for (let i = 0; i < selectorArray.length; i++) {
    //childKeySelectorArray[i] = (key) => (state) => selectorArray[i](state)[key];
    childKeySelectorArray[i] = makeChildKeySelectorBySelector(selectorArray[i]);
  }
  let list = [];
  let keyMapIndex = {};

  let indexMapObjectKeys = {};
  const lenSelector = selectorArray.length;
  let lastResultObjectKeys = [];

  let rootObserable = [];
  for (let i = 0; i < selectorArray.length; i++) {
    let fieldName = fieldArray[i];
    rootObserable.push(createRxStateBySelector(selectorArray[i], `${fieldName}_ObjectKeysChange`, i, queryID));
  }
  Rx.Observable.merge(...rootObserable)
    .mergeMap((val) => {
      ////cl(`rxQueryLeftOuterJoin => ${queryID}:`, " mergeMap() val:", val);
      const { lastValue, nextValue, field, key } = val;

      // update each the child key set of Object that selected by each selector
      if (nextValue) {
        let { innerObjectKeys } = getRelObjectKeys(nextValue, lastValue);
        if ((Object.keys(innerObjectKeys).length === Object.keys(lastValue || {}).length) &&
          (Object.keys(innerObjectKeys).length === Object.keys(nextValue).length)
        ) {
          //cl(`${field}: NO change checked.`);
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

      let nextResultObjectKeys = indexMapObjectKeys[0];
      for (let i = 1; i < lenSelector; i++) {
        let { leftObjectKeys } = getRelObjectKeys(nextResultObjectKeys, indexMapObjectKeys[i]);
        nextResultObjectKeys = leftObjectKeys;
      }

      //cl(`rxQueryLeftOuterJoin => ${queryID}: nextResultObjectKeys:`, nextResultObjectKeys, `lastResultObjectKeys:`, lastResultObjectKeys);
      const { leftObjectKeys, innerObjectKeys, rightObjectKeys } = getRelObjectKeys(nextResultObjectKeys, lastResultObjectKeys);

      if (Object.keys(rightObjectKeys).length !== 0) {
        // we put all data operation into next stage
        arrayObserable.push(Rx.Observable.of({
          nextValue: nextResultObjectKeys,
          lastValue: lastResultObjectKeys,
          field: `resultObjectKeysChange_${queryID}`,
          key
        }));
      }
      // TODO: improve here
      lastResultObjectKeys = nextResultObjectKeys;
      for (const key in rightObjectKeys) {
        destroyRxStateByIndex(fieldArray[0], key, queryID);
      }
      for (const key in leftObjectKeys) {
        const obserable = createRxStateBySelector(childKeySelectorArray[0](key), fieldArray[0], key, queryID);
        if (obserable) {
          arrayObserable.push(obserable);
        }
      }
      return Rx.Observable.merge(...arrayObserable);
    })
    .map(commonListOperation(list, keyMapIndex, queryID))
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        resultFun(val);
      }
    });

  return unsub;
}
