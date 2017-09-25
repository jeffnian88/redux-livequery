Provide LiveQuery (SQL-like) to redux state container

[![npm downloads](https://img.shields.io/npm/dm/redux-livequery.svg)](https://www.npmjs.com/package/redux-livequery)

## Todos Live Demo using redux-livequery library
* [Todos Live Demo](https://twstorepos.firebaseapp.com)

* [Todos Live Demo Source code](https://github.com/jeffnian88/redux-livequery-todos-example)


## Motivation

Redux provide a good way to manage the state for React apps, but it lacks query/aggregation operation to compose the single result value from multiple redux state(If we take redux as database, then redux should have query-like operation to react component). And in reselect, you have to manually compose your data and put yout logic in different nested functions.

Redux-livequery can give a live query (SQL-like operation) to group values from multiple redux state together (Indeed, it decouples the direct-subscribe to redux store). It only subscribes the state you care about to give you a better render performance. Whenever the state you care about changes, the result function would be invoked. And then, you can put all your logic to shape the data in one place.

By this approach above, it helps you keep your redux state normalized structures and have extremely simple reducer(no more filter or findIndex operation, we should retrieve the data by indexing not by filtering or finding) as well.

## Install

This has peer dependencies of `rxjs@5.x.x`, `redux` and `immutability-helper`, which will have to be installed as well.

```bash
npm install --save redux-livequery
(or yarn add redux-livequery)
```

## Configuring The Store

```js
import { livequeryEnhancer } from 'redux-livequery';
const enhancer = compose(
  livequeryEnhancer(),
  ....
  applyMiddleware(....),
);
import initialState from '../reducers/initialState';
export const store = createStore(rootReducer, initialState || {}, enhancer);
```

## Example

## rxQueryLeftJoin API Example
```js
import { rxQueryLeftJoin } from 'redux-livequery';
...
  componentWillMount(){
    ...
    const selector0 = (state) => state.favorite; // The child's key of Object selected by first selector would be major key set.
    const selector1 = (state) => state.profile;
    // The following is an example,
    // state.favorite = {storeId1: Object1, storeId2: Object2},
    // state.profile = {storeId1: Object3, storeId2: Object4, storeId3:Object5}
    const field0 = 'favor'; 
    const field1 = 'profile';
    this.unsubscribe = rxQueryLeftJoin([selector0, selector1], [field0, field1], (favoriteList) => {
      // equals SQL query:
      // SELECT * FROM profile LEFT JOIN favorite ON profile.id=favorite.id;

      console.log(`next:`, favoriteList);

      // favoriteList value would be [{key: storeId1, favor: {Object1}, profile: {Object3}}
      //                        {key: storeId2, favor: {Object2}, profile: {Object4}}]
    });
  }
  componentWillUnmount(){
    // after a while, unsubscribe the livequery
    // exec unsubscribe when you don't need to observe the value
    this.unsubscribe();
  }

```

## rxQueryInnerJoin API Example
```js
import { rxQueryInnerJoin } from 'redux-livequery';
...
  componentWillMount(){
    ...
    const selector0 = (state) => state.favorite;
    const selector1 = (state) => state.profile;
    //state.favorite={storeId1: Object1, storeId2: Object2},
    //state.profile={storeId2: Object4, storeId3:Object5}
    const field0 = 'favor'; 
    const field1 = 'profile';
    this.unsubscribe = rxQueryInnerJoin([selector0, selector1], [field0, field1], (result) => {
      // equals SQL query:
      // SELECT * FROM profile INNER JOIN favorite ON profile.id=favorite.id;

      console.log(`result:`, result);

      // result value would be [{key:storeId2, favor:{Object2}, profile:{Object4}}]

    });
  }
  componentWillUnmount(){
    // after a while, unsubscribe the livequery
    // exec unsubscribe when you don't need to observe the value
    this.unsubscribe();
  }

```

## Usage

#### `rxQueryLeftJoin(selectors, fields, resultFunc, debounceTime)`

```js
import { rxQueryLeftJoin } from 'redux-livequery';
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
