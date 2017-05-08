Provide LiveQuery to redux state container


[![npm downloads](https://img.shields.io/npm/dm/redux-livequery.svg)](https://www.npmjs.com/package/redux-livequery)

## Motivation

Redux state container give a good way to manage the state for React apps, but it lacks query/aggregation operation to compose the single result value you would like to have from multiple redux state.

Redux-livequery can provide a query operation to group values from multiple redux state together. It also leverages the redux state subscribe(a low-level API) and RxJS to give live feature to your query (Indeed, it decouples the direct-subscribe to redux store). It only subscribes the state you care about to give you a good render performance. Whenever the state you care about changes, the result value would be computed again. And, you can also put your logic to shape the data that you would like to have in the same place.

By this above approach, it helps you keep your redux state normalized structures and reducer(pure function) simple as well.

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

### `rxQuerySimple(selectorArray, fieldArray, resultFunc, debounceTime)`
```js
import { rxQuerySimple } from 'redux-livequery';  New API: 2017-5-6
```

This API will give you simple select operation.

#### Arguments

##### 1. selectorArray (Array): Choose the state you want to observe, the selector is to select the Object or Array.
##### 2. fieldArray (Array): Give each selector a field name
##### 3. resultFunc (Function): The callback to be invoked whenever any state you select changes.
##### 4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

##### (Function): A function that unsubscribes the live query.

### `rxQueryBasedOnObjectKeys(selectorArray, fieldArray, resultFunc, debounceTime)`
```js
import { rxQueryBasedOnObjectKeys } from 'redux-livequery';
```

#### Arguments

##### 1. selectorArray (Array): Choose the state you want to observe, the child's key of Objec selected by the first selector is primary key set.
##### 2. fieldArray (Array): Give each selector a field name
##### 3. resultFunc (Function): The callback to be invoked whenever any state you select changes, the result value would be composed and have the key and field that owns immutable Object.
##### 4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

##### (Function): A function that unsubscribes the live query.

### `rxQueryInnerJoin(selectorArray, fieldArray, resultFunc, debounceTime)`
```js
import { rxQueryInnerJoin } from 'redux-livequery';  New API: 2017-5-6
```

This API will reactively get the intersection of the key set by scaning Object selected by each selector.

The resultFunc would be invoked only on the condition intersection set is not empty (or the size of intersection is not zero) and the state you would like to observe changes.

#### Arguments

##### 1. selectorArray (Array): Choose the state you want to observe, the selector is to select the Object that has the child key.
##### 2. fieldArray (Array): Give each selector a field name
##### 3. resultFunc (Function): The callback to be invoked whenever any state you select changes, the result value would be composed and have the key and field that owns immutable Object.
##### 4. debounceTime (Number, Default: 0): Time(ms) to debounce the trigger of resultFunc

#### Returns

##### (Function): A function that unsubscribes the live query.

## Example for rxQuerySimple API
```js
import { rxQuerySimple } from 'redux-livequery';
...
  constructor(){
    ...
    let selector0 = (state) => state.favorite;
    let selector1 = (state) => state.profile;
    //state.favorite={storeId1: Object1, storeId2: Object2},
    //state.profile={storeId2: Object4, storeId3:Object5}
    let field0 = 'favor'; 
    let field1 = 'profile';
    this.unsubscribe = rxQuerySimple([selector0, selector1], [field0, field1], (result) => {
      // equals SQL query:
      // SELECT * FROM profile
      // SELECT * FROM favorite

      console.log(`result:`, result);

      // result value would be {profile:{storeId2: Object4, storeId3:Object5}
      //                        favorite:{storeId1: Object1, storeId2: Object2}}

      // Below here you can do whatever you want here, for example
      // map(), filter(), reduce(), flatten()

      // this.setState({});     //set local state
      // or
      // dispatch({});          // set redux state

      // whenever state.favorite or state.profile change, the result function would be invoked
    });
    componentWillUnmount(){
      // after a while, unsubscribe the livequery
      // exec unsubscribe when you don't need to observe the value
      this.unsubscribe();
    }
  }
```

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
      // dispatch({...}); // set redux state

      // whenever state.favorite or state.profile(API will dynamically subscribe) change, the result function would be invoked
    });
    componentWillUnmount(){
      // after a while, unsubscribe the livequery
      // exec unsubscribe when you don't need to observe the value
      this.unsubscribe();
    }
  }
```
## Example repo

https://github.com/jeffnian88/redux-livequery-todos-example

https://github.com/jeffnian88/redux-livequery-example