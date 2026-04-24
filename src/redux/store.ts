import { combineReducers, configureStore } from "@reduxjs/toolkit";

// Import Reducers
import navSiteReducer from "@/redux/navSiteReducer";
import userReducer from "@/redux/userReducer";

// Combine reducers here
const store = combineReducers({
  nav: navSiteReducer,
  user: userReducer,
});

// Create store
export default configureStore({ reducer: store });
