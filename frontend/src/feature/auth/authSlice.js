import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: null,        
    user: null,         
    refreshToken: null,
  },
  reducers: {
    setCredentials: (state, action) => {
      state.token = action.payload.access_token;    
      state.user = action.payload.user;          

    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.refreshToken = null;
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;