import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout, setCredentials } from '../feature/auth/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:5001',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
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
    const refreshResult = await baseQuery({
      url: '/auth/refresh-token',
      method: 'POST'
    }, api, extraOptions);

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
  tagTypes: ['Bill', 'User', 'Profile', 'BillStatus'],
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
    logout: builder.mutation({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),
    

    // Bill endpoints
    createBill: builder.mutation({
      query: (billData) => ({
        url: '/bills',
        method: 'POST',
        body: billData,
      }),
      invalidatesTags: ['Bill'],
    }),
    
    getUserCreatedBills: builder.query({
      query: (userId) => `/user/${userId}/bills/created`,
      providesTags: ['Bill'],
    }),
    
    getUserInvitedBills: builder.query({
      query: (userId) => `/user/${userId}/bills/invited`,
      providesTags: ['Bill'],
    }),
    
    getUserParticipatingBills: builder.query({
      query: (userId) => `/user/${userId}/bills/participating`,
      providesTags: ['Bill'],
    }),
    
    getBillDetails: builder.query({
      query: (billId) => `/bills/${billId}`,
      providesTags: ['Bill'],
    }),
    
    inviteUsersToBill: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/invite`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { billId }) => [
        'Bill',
        { type: 'BillStatus', id: billId }
      ],
    }),

    
    respondToBillInvitation: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/respond`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { billId }) => [
        'Bill',
        { type: 'BillStatus', id: billId }
      ],
    }),
    
    finalizeBill: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/finalize`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Bill'],
    }),
    
    markBillAsPaid: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/mark-paid`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Bill'],
    }),

    getBillStatus: builder.query({
      query: ({ billId, userId }) => ({
        url: `/bills/${billId}/status`,
        params: { user_id: userId }
      }),
      providesTags: (result, error, { billId }) => [
        { type: 'BillStatus', id: billId },
        'Bill'
      ],
    }),
    
    // User search
    searchUsers: builder.query({
      query: (searchTerm) => `/users/search?q=${searchTerm}`,
      providesTags: ['User'],
    }),
    
    // Profile endpoints
    getUserProfile: builder.query({
      query: (userId) => `/user/${userId}/profile`,
      providesTags: ['Profile'],
    }),
    
    updateUserProfile: builder.mutation({
      query: ({ userId, ...data }) => ({
        url: `/user/${userId}/profile`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Profile'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useCreateBillMutation,
  useGetUserCreatedBillsQuery,
  useGetUserInvitedBillsQuery,
  useGetUserParticipatingBillsQuery,
  useGetBillDetailsQuery,
  useInviteUsersToBillMutation,
  useRespondToBillInvitationMutation,
  useFinalizeBillMutation,
  useMarkBillAsPaidMutation,
  useSearchUsersQuery,
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
  useGetBillStatusQuery,
} = api;