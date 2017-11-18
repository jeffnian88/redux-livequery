Provide LiveQuery (SQL-like) to react component

[![npm downloads](https://img.shields.io/npm/dm/redux-livequery.svg)](https://www.npmjs.com/package/redux-livequery)

## Todos Live Demo using redux-livequery library
* [Todos Live Demo](https://twstorepos.firebaseapp.com) ([Source code](https://github.com/jeffnian88/redux-livequery-todos-example))


## Motivation

Redux provide a good way to manage the state for React apps, but it lacks query/aggregation operation to compose multiple state together to get the data we would like(If we take predux as database, then redux should have query-like operation to react component). And in reselect, you have to manually compose your data and put yout logic in different nested functions.

Redux-livequery can give you a SQL-like live query to help you group values from multiple redux state together. And It only subscribes the state you care about, therefore it could let you have a better render performance. Whenever the state you care about changes, the result function would be invoked. (Indeed, it decouples the direct-subscribe to redux store)

For example, if you have long long array(around 100~1000), when the state which you care about in array changes, the result function would be invoked, so you don't filter array for your component. By contrast, if the other states in array which you don't care about change, the result function would not be invoked. The both situiation above, you don't need filter operation in your result function (redux-livequery library use redux low level api(store.subscribe) instead).
But in reselect, any state in array changes, the redux always will invoke your selector function and you always filter the array whether the state that you care about changes or not.
What's more, the reselect didn't provide debounce functionality to optimize your UI render frequency. In some external action trigger redux update like websocket or socket.io, you may not easily get the the high performance UX.

So,redux-livequery provide debounce functionality to let you tune your UI render performance/frequency.

## Install

This has peer dependencies of `rxjs@5.x.x`, `redux` and `immutability-helper`, which will have to be installed as well.

```bash
npm install --save redux-livequery (or yarn add redux-livequery)
```

## Configuring The Store

```js
import { livequeryEnhancer } from 'redux-livequery';
const enhancer = compose(
  livequeryEnhancer(),
  ....
  applyMiddleware(....),
);
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
    },
    33 //debounceTime 33ms
    );
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
    },
    33 //debounceTime 33ms
    );
  }
  componentWillUnmount(){
    // unsubscribe the livequery
    this.unsubscribe();
  }

```
