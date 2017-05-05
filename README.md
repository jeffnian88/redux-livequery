Provide LiveQuery to redux state container


[![npm downloads](https://img.shields.io/npm/dm/redux-livequery.svg)](https://www.npmjs.com/package/redux-livequery)

## Motivation

Redux state container give a good way to manage the state for React apps, but it lacks query/aggregation operation to compose multiple state into to the single result value you care about.

Redux-livequery can provide a query operation to group values from multiple redux state together. It also laverages the state subscribe API of Redux and RxJS to give us live feature. It only subscribes the state you need to obserable to give you a good render performance. Whenever the state you care about changes, the result value would be computed again. 

## Install

This has peer dependencies of `rxjs@5.x.x`, `redux` and `immutability-helper`, which will have to be installed as well.

```bash
npm install --save redux-livequery
```


Configuring The Store

```js
import { livequeryEnhancer } from 'redux-livequery';
const enhancer = compose(
  autoRehydrate(),
  applyMiddleware(....),
  livequeryEnhancer(),
  window.devToolsExtension ? window.devToolsExtension() : f => f // add support for Redux dev tools,
);
import initialState from '../reducers/initialState';
export const store = createStore(rootReducer, initialState || {}, enhancer);
```

## Usage

import the module in your any component

```js
import { rxQueryBasedOnObjectKeys } from 'redux-livequery';
```

### `rxQueryBasedOnObjectKeys(selectorArray, fieldArray, resultFunc, debounceTime)`

#### Arguments

##### 1. selectorArray (Array): Choose the state you want to observe
##### 2. fieldArray (Array): Give each selector a field name
##### 3. resultFunc (Function):  The callback to be invoked whenever any state you observe change, the result value would be composed like sql join operation.
##### 4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

##### (Function): A function that unsubscribes the live query.

## Example

```js
import { rxQueryBasedOnObjectKeys } from 'redux-livequery';
...

  constructor(){
    let selector0 = (state) => state.favorite;
    let selector1 = (state) => state.profile;
    //state.favorite={storeId1: Object1, storeId2: Object2},
    //state.profile={storeId1: ObjectA, storeId2: ObjectB, storeId3:ObjectC}
    let field0 = 'favor';
    let field1 = 'profile';
    // equals SQL query:
    // SELECT * FROM profile RIGHT/LEFT JOIN favorite ON profile.id=favorite.id;
    let unsub = rxQueryBasedOnObjectKeys([selector0, selector1], [field0, field1], (result) => {
      let favoriteList = result;
      console.log(`next:`, favoriteList);

      // result would be [{key:storeId1, favor:{Object1}, profile:{ObjectA}},
      //                  {key:storeId2, favor:{Object2}, profile:{ObjectB}}]
      // just like SQL right join.
      // Below here you can do whatever you want like:
      // this.setState({favorList:favoriteList});

      // whenever state.favorite or state.profile change, the result function would be invoked
    });

    // after a while, unsubscribe the livequery
    unsub();
  }
```