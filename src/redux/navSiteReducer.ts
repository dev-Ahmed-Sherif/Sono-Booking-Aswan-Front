import { createSlice } from "@reduxjs/toolkit";

// const item = localStorage.getItem("Nav");

export const navReducer = createSlice({
  name: "nav",
  initialState: {
    active: "/dashboard",
  },
  reducers: {
    setLink: (state, action) => {
      state.active = action.payload;
    },
  },
});

export const { setLink } = navReducer.actions;

export default navReducer.reducer;
