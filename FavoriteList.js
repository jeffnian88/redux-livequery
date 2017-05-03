//import { rxQueryBasedOnObjectKeys } from '../redux-livequery';
import { rxQueryBasedOnObjectKeys } from 'redux-livequery';
export default function FavoriteList(cb) {
  let selector0 = (state) => state.favorite.uidMapFavorite;
  let selector1 = (state) => state.profile.store.uidMapProfile;
  let field0 = 'favor';
  let field1 = 'profile';
  let unsub = rxQueryBasedOnObjectKeys([selector0, selector1], [field0, field1], (favoriteList) => {
    console.log(`next:`, favoriteList);

    let nextList = favoriteList.map((each) => {
      let mergedProfile = {};
      for (let field in each.profile) {
        //console.log("field:", field, typeof each.favor[field]);
        if ('object' === typeof each.profile[field])
          mergedProfile = Object.assign({}, mergedProfile, each.profile[field]);
      }
      return Object.assign({}, mergedProfile, { key: each.key });
    });
    console.log(`nextList:`, nextList);
    cb(nextList);
    //store.dispatch({ type: "UPDATE_FAVORITELIST", payload: { favoriteList: nextList } });
  }, 300);
  //setTimeout(unsub, 20000);
  return unsub;
}