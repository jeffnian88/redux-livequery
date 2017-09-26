Provide LiveQuery (SQL-like) to redux state container

[![npm downloads](https://img.shields.io/npm/dm/redux-livequery.svg)](https://www.npmjs.com/package/redux-livequery)

## Todos Live Demo using redux-livequery library
* [Todos Live Demo](https://twstorepos.firebaseapp.com)

* [Todos Live Demo Source code](https://github.com/jeffnian88/redux-livequery-todos-example)


## Motivation

Redux provide a good way to manage the state for React apps, but it lacks query/aggregation operation to compose the single result value from multiple redux state(If we take redux as database, then redux should have query-like operation to react component). And in reselect, you have to manually compose your data and put yout logic in different nested functions.

Redux-livequery can give you a live query (SQL-like) to group values from multiple redux state together (Indeed, it decouples the direct-subscribe to redux store). It only subscribes the state you care about, therefore it may let you have a better render performance. Whenever the state you care about changes, the result function would be invoked. And then, you can put all your logic to shape the data in one place.

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
  componentDidMount(){
    ...
    const selector0 = (state) => state.completeSet;
    const selector1 = (state) => state.task;
    const field0 = 'complete'; 
    const field1 = 'task';
    this.unsubscribe = rxQueryLeftJoin([selector0, selector1], [field0, field1], (completeTaskList) => {
      // equals SQL query:
      // SELECT * FROM complete LEFT JOIN task ON complete.id=task.id;
      console.log(`next:`, completeTaskList);
    });
  }
  componentWillUnmount(){
    // unsubscribe the livequery
    this.unsubscribe();
  }

```

## rxQueryInnerJoin API Example
```js
import { rxQueryInnerJoin } from 'redux-livequery';
...
  componentDidMount(){
    ...
    const selector0 = (state) => state.completeSet;
    const selector1 = (state) => state.activeSet;
    const selector2 = (state) => state.task;
    const field0 = 'complete'; 
    const field1 = 'active';
    const field2 = 'task';
    this.unsubscribe = rxQueryInnerJoin([selector0, selector1, selector2], [field0, field1, field2], (completeAndActiveTaskList) => {
      // equals SQL query:
      // SELECT * FROM complete INNER JOIN active ON complete.id=active.id INNER JOIN task on task.id===complete.id
      console.log(`completeAndActiveTaskList:`, completeAndActiveTaskList);
    });
  }
  componentWillUnmount(){
    // unsubscribe the livequery
    this.unsubscribe();
  }

```