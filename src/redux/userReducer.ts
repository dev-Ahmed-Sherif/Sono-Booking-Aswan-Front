import { createSlice } from "@reduxjs/toolkit";

export const userReducer = createSlice({
  name: "user",
  initialState: {
    id: "",
    organizationId: "",
    role: "",
    governorateId: "",
  },
  reducers: {
    setOrganizationId: (state, action) => {
      state.organizationId = action.payload;
    },
    setRole: (state, action) => {
      state.role = action.payload;
    },
    setUserId: (state, action) => {
      state.id = action.payload;
    },
    setGovernorateId: (state, action) => {
      state.governorateId = action.payload;
    },
  },
});

export const { setOrganizationId, setRole, setUserId, setGovernorateId } =
  userReducer.actions;

export default userReducer.reducer;
