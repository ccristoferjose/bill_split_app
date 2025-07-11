import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout, setCredentials } from '../features/auth/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:5001',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Try to refresh token
    const refreshResult = await baseQuery('/auth/refresh-token', api, extraOptions);

    if (refreshResult.data) {
      api.dispatch(setCredentials(refreshResult.data));
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
    // Auth endpoints
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
    refreshToken: builder.mutation({
      query: () => ({
        url: '/auth/refresh-token',
        method: 'POST',
      }),
    }),

    // User endpoints
    searchUsers: builder.query({
      query: (query) => ({
        url: `/users/search?q=${query}`,
      }),
    }),
    getUserProfile: builder.query({
      query: (userId) => `/users/${userId}`,
    }),
    updateProfile: builder.mutation({
      query: ({ userId, ...data }) => ({
        url: `/users/${userId}`,
        method: 'PUT',
        body: data,
      }),
    }),

    // Bill endpoints
    getBills: builder.query({
      query: (userId) => `/user/${userId}/bills/created`,
    }),
    getInvitedBills: builder.query({
      query: (userId) => `/user/${userId}/bills/invited`,
    }),
    getParticipatingBills: builder.query({
      query: (userId) => `/user/${userId}/bills/participating`,
    }),
    createBill: builder.mutation({
      query: (billData) => ({
        url: '/bills',
        method: 'POST',
        body: billData,
      }),
    }),
    getBillDetails: builder.query({
      query: (billId) => `/bills/${billId}`,
    }),
    inviteToBill: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/invite`,
        method: 'POST',
        body: data,
      }),
    }),
    respondToInvitation: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/respond`,
        method: 'POST',
        body: data,
      }),
    }),
    finalizeBill: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/finalize`,
        method: 'POST',
        body: data,
      }),
    }),
    markBillPaid: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/mark-paid`,
        method: 'POST',
        body: data,
      }),
    }),
    processMonthlyBills: builder.mutation({
      query: () => ({
        url: '/bills/process-monthly',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useSearchUsersQuery,
  useGetUserProfileQuery,
  useUpdateProfileMutation,
  useGetBillsQuery,
  useGetInvitedBillsQuery,
  useGetParticipatingBillsQuery,
  useCreateBillMutation,
  useGetBillDetailsQuery,
  useInviteToBillMutation,
  useRespondToInvitationMutation,
  useFinalizeBillMutation,
  useMarkBillPaidMutation,
  useProcessMonthlyBillsMutation,
} = api;