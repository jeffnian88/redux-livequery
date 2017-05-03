Provide SQL-like LiveQuery on redux state container

## Install

This has peer dependencies of `rxjs@5.x.x` and `redux`, which will have to be installed as well.

```bash
npm install --save redux-livequery
```


Configuring The Store

```js
import { livequeryEnhancer } from 'redux-livequery';
const enhancer = compose(
  autoRehydrate(),
  appliedMiddleware,
  livequeryEnhancer(),
  window.devToolsExtension ? window.devToolsExtension() : f => f // add support for Redux dev tools,
);
import initialState from '../reducers/initialState';
export const store = createStore(rootReducer, initialState || {}, enhancer);
```

## Usage

import the module in your any component

rxQueryBasedOnObjectKeys([selectors], [fields], resultFunc)

##### selectors: choose the state you want to observe
##### fields: Give each selector a field name
##### resultFunc: whenever any state you observe change, the result function would be invoked and result value would be composed like sql inner join.

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
    let unsub = rxQueryBasedOnObjectKeys([selector0, selector1], [field0, field1], (favoriteList) => {
      console.log(`next:`, favoriteList);

      // favoriteList would be [0:{favor:{Object1}, key:storeId1, {profile:{ObjectA}}},
      //                        1:{favor:{Object2}, key:storeId2, {profile:{ObjectB}}}]
      // just like SQL inner join.
      // do whatever you want
      // this.setState({favorList:favoriteList});

      // favoriteList will be composed by favorite and profile state
      // whenever state.favorite or state.profile change, the result function would be invoked

    });

    // after a while, unsubscribe the livequery
    unsub();
  }
```