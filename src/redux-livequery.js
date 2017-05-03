"use strict";
import update from 'immutability-helper';
var store = void 0;
var Rx = require('rxjs/Rx');

function makeCheckFuncWithSelector(selector, cb) {
  let currentValue = null;
  let previousValue = null;

  // Try to get first value since the checkFun only be invoked whenever state tree change.
  previousValue = currentValue;
  currentValue = selector(store.getState());
  if (previousValue !== currentValue) {
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

let queryIDMapRxStates = {};
var createRxStateBySelector = exports.createRxStateBySelector = function createRxStateBySelector(selector, field, key, queryID) {
  //console.log('createRxStateBySelector():', field, key);
  return Rx.Observable.create((subscriber) => {
    //console.log('Rx.Observable.create():', field, key);
    let func = makeCheckFuncWithSelector(selector, (nextValue, lastValue) => {
      let val = { selector, nextValue, lastValue, key, field };
      //console.log(`trigger next =>`, val);
      subscriber.next({ selector, nextValue, lastValue, key, field });
    });

    let unsub = store.subscribe(func);
    let rxStateID = `${field}_${key}_${queryID}`;
    //console.log(`subscribe():${rxStateID}`);
    queryIDMapRxStates[queryID] = Object.assign({}, queryIDMapRxStates[queryID], { [rxStateID]: { subscriber, unsub } });
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
    // if success
    return true;
  }
  return false;
}
var livequeryEnhancer = exports.livequeryEnhancer = function livequeryEnhancer() {
  return function (createStore) {
    return function (reducer, preloadedState, enhancer) {
      store = createStore(reducer, preloadedState, enhancer);

      // do whatever you want with store object

      return store;
    };
  };
}

var rxQueryBasedOnObjectKeys = exports.rxQueryBasedOnObjectKeys = function rxQueryBasedOnObjectKeys(selectorArray, fieldArray, resultFun, debounceTime = 0) {
  let queryID = Date.now();
  let unsub = () => unsubscribeRxQuery(queryID);
  let field0 = fieldArray[0];
  let newSelectorArray = [];
  for (let i = 1; i < selectorArray.length; i++) {
    newSelectorArray[i] = (uid) => (state) => selectorArray[i](state)[uid];
  }

  let list = [];
  createRxStateBySelector(selectorArray[0], field0, 0, queryID)
    .mergeMap(val => {
      //console.log("mergeMap() val:", val);
      let arrayObserable = [];
      let { nextValue, lastValue, field, key } = val;

      let passObserable = Rx.Observable.of(val);
      arrayObserable.push(passObserable);


      let deletedUidArray = [];
      if (lastValue) {
        deletedUidArray = Object.keys(lastValue).filter((uid) => (!(nextValue && (uid in nextValue))));
      }
      //console.log('deletedUidArray:', deletedUidArray);
      deletedUidArray.forEach((uid) => {
        for (let i = 1; i < fieldArray.length; i++) {
          destroyRxStateByIndex(fieldArray[i], uid, queryID);
        }
      });

      let addedUidArray = [];
      if (nextValue) {
        addedUidArray = Object.keys(nextValue).filter((uid) => (!(lastValue && (uid in lastValue))));
      }
      //console.log('addedUidArray:', addedUidArray);
      addedUidArray.forEach((uid) => {
        for (let i = 1; i < fieldArray.length; i++) {
          let obserable = createRxStateBySelector(newSelectorArray[i](uid), fieldArray[i], uid, queryID);
          arrayObserable.push(obserable);
        }
      });

      return Rx.Observable.merge(...arrayObserable);
    }).map(val => {
      //console.log("map() val:", val);
      let { nextValue, lastValue, key, field } = val;

      if (field === field0) {

        let deletedUidArray = [];
        if (lastValue) {
          deletedUidArray = Object.keys(lastValue).filter((uid) => (!(uid in nextValue)));
        }
        //console.log('deletedUidArray:', deletedUidArray);

        let addedUidArray = [];
        if (nextValue) {
          addedUidArray = Object.keys(nextValue).filter((uid) => (!(lastValue && (uid in lastValue))));
        }
        //console.log('addedUidArray:', addedUidArray);

        deletedUidArray.forEach((uid) => {
          //destroyRxStateByIndex(uid);
          let index = list.findIndex((each) => uid === each.key);
          //console.log(`${uid} delete index:`, index);
          if (index >= 0) {
            // delete element
            list = update(list, { $splice: [[index, 1]] });
            //console.log('del:', uid, index, list);
          } else {
            console.error("Impossible!!");
          }
        });
        addedUidArray.forEach((uid) => {
          let index = list.findIndex((each) => uid === each.key);
          //console.log(`${uid} add index:`, index);
          if (index >= 0) {
            console.error("Impossible!!");
          } else {
            // add element
            list = update(list, { $push: [Object.assign({}, { [field0]: nextValue[uid] }, { key: uid })] });
          }
        });

        if (nextValue) {
          let andUidArray = Object.keys(nextValue).filter((uid) => (lastValue && (uid in lastValue)));
          andUidArray.forEach((uid) => {
            if (nextValue[uid] !== lastValue[uid]) {

              let index = list.findIndex((each) => uid === each.key);
              if (index >= 0) {
                // modify element
                //console.log("modify index:", index);
                list = update(list, { [index]: { [field0]: { $set: nextValue[uid] } } });
              } else {
                console.error("Impossible!!");
              }
            }
          });
        }
      } else {
        // field is other 
        let uid = key;
        let index = list.findIndex((each) => uid === each.key);
        if (index >= 0) {
          // modify element
          //console.log("modify index:", index);
          list = update(list, { [index]: { [field]: { $set: nextValue } } });
        } else {
          list = update(list, { $push: [Object.assign({}, { [field]: nextValue }, { key: uid })] });
        }
      }
      return list;
    })
    .debounceTime(debounceTime)
    .subscribe({
      next: (val) => {
        //console.log(`next:`, favoriteList);
        resultFun(val);
      }
    });

  return unsub;
};
