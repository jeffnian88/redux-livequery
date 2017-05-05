Provide LiveQuery to redux state container


[![npm downloads](https://img.shields.io/npm/dm/redux-livequery.svg)](https://www.npmjs.com/package/redux-livequery)

## Motivation

Redux state container give a good way to manage the state for React apps, but it lacks query/aggregation operation to compose the single result value you care about from multiple redux state.

Redux-livequery can provide a query operation to group values from multiple redux state together. It also laverages the redux state subscribe API and RxJS to give us live feature. It only subscribes the state you need to obserable to give you a good render performance. Whenever the state you care about changes, the result value would be computed again.

By this approach, you can keep your global redux state data normalized structures and reducer(pure function) simple.

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

import the module in any react component

```js
import { rxQueryBasedOnObjectKeys } from 'redux-livequery';
```

### `rxQueryBasedOnObjectKeys(selectorArray, fieldArray, resultFunc, debounceTime)`

#### Arguments

##### 1. selectorArray (Array): Choose the state you want to observe, the first selector is to select the Object that has the child key.
##### 2. fieldArray (Array): Give each selector a field name
##### 3. resultFunc (Function): The callback to be invoked whenever any state you select changes, the result value would be composed and have the key and field that owns immutable Object.
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
    this.unsubscribe = rxQueryBasedOnObjectKeys([selector0, selector1], [field0, field1], (result) => {
      // equals SQL query:
      // SELECT * FROM profile RIGHT/LEFT JOIN favorite ON profile.id=favorite.id;

      let favoriteList = result;
      console.log(`next:`, favoriteList);

      // result value would be [{key:storeId1, favor:{Object1}, profile:{ObjectA}},
      //                  {key:storeId2, favor:{Object2}, profile:{ObjectB}}]
      // just like SQL right join.
      // Below here you can do whatever you want:
      // for example
      // this.setState({favorList:favoriteList});

      // whenever state.favorite or state.profile(API will dynamically subscribe) change, the result function would be invoked

      
      // after a while, unsubscribe the livequery
      this.unsubscribe();
    });
  }
```