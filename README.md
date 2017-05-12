Provide LiveQuery to redux state container

[![npm downloads](https://img.shields.io/npm/dm/redux-livequery.svg)](https://www.npmjs.com/package/redux-livequery)

## Todos Live Demo & Repo for redux-livequery
* [Todos Live Demo](https://twstorepos.firebaseapp.com)

* https://github.com/jeffnian88/redux-livequery-todos-example

* https://github.com/jeffnian88/redux-livequery-example

## Motivation

Redux provide a good way to manage the state for React apps, but it lacks query/aggregation operation to compose the single result value you would like to have from multiple redux state.

Redux-livequery can give a live query (SQL-like operation) to group values from multiple redux state together (It decouples the direct-subscribe to redux store). It only subscribes the state you care about to give you a better render performance. Whenever the state you care about changes, the result function would be invoked. And then, you can put all your logic to shape the data in the same place.

By this above approach, it helps you keep your redux state normalized structures and reducer simple as well.

## Install

This has peer dependencies of `rxjs@5.x.x`, `redux` and `immutability-helper`, which will have to be installed as well.

```bash
npm install --save redux-livequery
(or yarn add redux-livequery)
```

### Configuring The Store

```js
import { livequeryEnhancer } from 'redux-livequery';
const enhancer = compose(
  livequeryEnhancer(),
  autoRehydrate(),
  applyMiddleware(....),
  window.devToolsExtension ? window.devToolsExtension() : f => f // add support for Redux dev tools,
);
import initialState from '../reducers/initialState';
export const store = createStore(rootReducer, initialState || {}, enhancer);
```

### Configuring The Store for Cross-component Query Support(Optional)


```js
import { livequeryEnhancer } from 'redux-livequery';
import import './livequery';
const enhancer = compose(
  livequeryEnhancer(),
  autoRehydrate(),
  applyMiddleware(....),
  window.devToolsExtension ? window.devToolsExtension() : f => f // add support for Redux dev tools,
);
import initialState from '../reducers/initialState';
export const store = createStore(rootReducer, initialState || {}, enhancer);
runLivequery();
```

```js
// index.js file in ./livequery
import { combineLivequery } from 'redux-livequery';
import someQuery from './someQuery';
const rootLivequery = combineLivequery(
  someQuery
);
export default rootLivequery;
```

```js
// someQuery.js file in ./livequery
import { rxQuerySimple } from 'redux-livequery';
export default function someQuery(store) {
  console.log("someQuery()");
  let selector0 = (state) => state.task.isComplete;
  let selector1 = (state) => state.task.isActive;
  rxQuerySimple([selector0, selector1], ['isComplete', 'isActive'], (completeActive) => {
    // you can do whatever you want here
    // ex: filter, reduce, map
    let isCompleteNotActive = {};
    for (let key in completeActive.isComplete) {
      if (!(key in completeActive.isActive)) {
        isCompleteNotActive[key] = completeActive.isComplete[key];
      }
    }
    // set data into redux state
    store.dispatch({ type: "SET_COMPLETE_NOT_ACTIVE", payload: { isCompleteNotActive } });
  }, 0);
}
```


## Usage

#### `rxQueryBasedOnObjectKeys(selectors, fields, resultFunc, debounceTime)`
```js
import { rxQueryBasedOnObjectKeys } from 'redux-livequery';
```

#### Arguments

1. selectors (Array): Choose the state you want to observe, the child's key of Objec selected by the first selector is primary key set.
2. fields (Array): Give each selector a field name
3. resultFunc (Function): The callback to be invoked whenever any state you select changes, the result value would be composed and have the key and field that owns immutable Object.
4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

(Function): A function that unsubscribes the live query.

#### `rxQueryInnerJoin(selectors, fields, resultFunc, debounceTime)`
```js
import { rxQueryInnerJoin } from 'redux-livequery';  New API: 2017-5-6
```

This API will reactively get the intersection of the key set by scaning Object selected by each selector.

The resultFunc would be invoked only on the condition intersection set is not empty (or the size of intersection is not zero) and the state you would like to observe changes.

#### Arguments

1. selectors (Array): Choose the state you want to observe, the selector is to select the Object that has the child key.
2. fields (Array): Give each selector a field name
3. resultFunc (Function): The callback to be invoked whenever any state you select changes, the result value would be composed and have the key and field that owns immutable Object.
4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

(Function): A function that unsubscribes the live query.

#### `rxQueryOuterJoin(selectors, fields, resultFunc, debounceTime)`
```js
import { rxQueryOuterJoin } from 'redux-livequery';  New API: 2017-5-9
```

This API will reactively get the union of the key set by scaning Object selected by each selector.

The resultFunc would be invoked only on the condition union set is not empty (or the size of union is not zero) and the state you would like to observe changes.

#### Arguments

1. selectors (Array): Choose the state you want to observe, the selector is to select the Object that has the child key.
2. fields (Array): Give each selector a field name
3. resultFunc (Function): The callback to be invoked whenever any state you select changes, the result value would be composed and have the key and field that owns immutable Object.
4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

(Function): A function that unsubscribes the live query.

#### `rxQuerySimple(selectors, fields, resultFunc, debounceTime)`
```js
import { rxQuerySimple } from 'redux-livequery';  New API: 2017-5-6
```

This API will give you simple select operation.

#### Arguments

1. selectors (Array): Choose the state you want to observe, the selector is to select the Object or Array.
2. fields (Array): Give each selector a field name
3. resultFunc (Function): The callback to be invoked whenever any state you select changes.
4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

(Function): A function that unsubscribes the live query.

## Example for rxQueryBasedOnObjectKeys API
```js
import { rxQueryBasedOnObjectKeys } from 'redux-livequery';
...
  constructor(){
    ...
    let selector0 = (state) => state.favorite;// The child's key of Object selected by first selector would be major key set.
    let selector1 = (state) => state.profile;
    //state.favorite={storeId1: Object1, storeId2: Object2},
    //state.profile={storeId1: Object3, storeId2: Object4, storeId3:Object5}
    let field0 = 'favor'; 
    let field1 = 'profile';
    this.unsubscribe = rxQueryBasedOnObjectKeys([selector0, selector1], [field0, field1], (result) => {
      // equals SQL query:
      // SELECT * FROM profile RIGHT JOIN favorite ON profile.id=favorite.id;

      let favoriteList = result;
      console.log(`next:`, favoriteList);

      // result value would be [{key:storeId1, favor:{Object1}, profile:{Object3}}
      //                        {key:storeId2, favor:{Object2}, profile:{Object4}}]

      // Below here you can do whatever you want here, for example
      // map(), filter(), reduce(), flatten()

      // this.setState({favorList:favoriteList});              //set local state
      // or
      // dispatch({type:'ACTION_NAME', payload:favoriteList}); // set redux state

      // whenever state.favorite or state.profile(API will dynamically subscribe) change, the result function would be invoked
    });
    componentWillUnmount(){
      // after a while, unsubscribe the livequery
      // exec unsubscribe when you don't need to observe the value
      this.unsubscribe();
    }
  }
```

## Example for rxQueryInnerJoin API
```js
import { rxQueryInnerJoin } from 'redux-livequery';
...
  constructor(){
    ...
    let selector0 = (state) => state.favorite;
    let selector1 = (state) => state.profile;
    //state.favorite={storeId1: Object1, storeId2: Object2},
    //state.profile={storeId2: Object4, storeId3:Object5}
    let field0 = 'favor'; 
    let field1 = 'profile';
    this.unsubscribe = rxQueryInnerJoin([selector0, selector1], [field0, field1], (result) => {
      // equals SQL query:
      // SELECT * FROM profile INNER JOIN favorite ON profile.id=favorite.id;

      console.log(`result:`, result);

      // result value would be [{key:storeId2, favor:{Object2}, profile:{Object4}}]

      // Below here you can do whatever you want here, for example
      // map(), filter(), reduce(), flatten()

      // this.setState({...});              //set local state
      // or
      // dispatch({...});                   // set redux state

      // whenever state.favorite or state.profile(API will dynamically subscribe) change, the result function would be invoked
    });
    componentWillUnmount(){
      // after a while, unsubscribe the livequery
      // exec unsubscribe when you don't need to observe the value
      this.unsubscribe();
    }
  }
```
