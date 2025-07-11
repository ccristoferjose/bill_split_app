import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout, setCredentials } from '../feature/auth/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:5001',
  prepareHeaders: (headers, { getState }) => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE3MjUzMTk0NTQsImV4cCI6MTcyNTMyMDM1NH0.aN8GktINswN6lIziBN3G8hiC7itFgUwZ96XaKR11Rbo';
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Try to get a new token
    const refreshResult = await baseQuery('/auth/refresh-token', api, extraOptions);

    if (refreshResult.data) {
      // Store the new token
      api.dispatch(setCredentials(refreshResult.data));

      // Retry the original query with the new token
      result = await baseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const api = createApi({
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    register: builder.mutation({
      query: (credentials) => ({
        url: '/auth/register',
        method: 'POST',
        body: credentials,
      }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = api;