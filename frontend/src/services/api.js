import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { logout } from '../feature/auth/authSlice';

// Amplify automatically refreshes the access token when it expires.
// prepareHeaders calls fetchAuthSession() before every request so we always
// send a fresh token without any manual refresh logic.
const baseQuery = fetchBaseQuery({
  baseUrl: 'http://localhost:5001',
  credentials: 'include',
  prepareHeaders: async (headers, { getState }) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
    } catch {
      // Amplify session not available — user is not signed in
    }
    return headers;
  },
});

// Dispatch logout on 401 so the UI redirects to login
const baseQueryWithLogout = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    api.dispatch(logout());
  }
  return result;
};

export const api = createApi({
  baseQuery: baseQueryWithLogout,
  tagTypes: ['Bill', 'User', 'Profile', 'BillStatus', 'Friend', 'MonthlyPayment', 'Transaction'],
  endpoints: (builder) => ({
    // Auth — only sync endpoint remains; login/register handled by Cognito SDK
    syncUser: builder.mutation({
      query: (data) => ({
        url: '/auth/sync',
        method: 'POST',
        body: data,
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

    deleteBill: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}`,
        method: 'DELETE',
        body: data,
      }),
      invalidatesTags: ['Bill'],
    }),

    payBillInFull: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/pay-in-full`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Bill'],
    }),

    reopenBill: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/reopen`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Bill'],
    }),

    startMonthlyBillCycle: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/new-cycle`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Bill'],
    }),

    getMonthlyPayments: builder.query({
      query: (userId) => `/user/${userId}/monthly-payments`,
      providesTags: ['MonthlyPayment'],
    }),

    getBillCyclePayments: builder.query({
      query: ({ billId, year, month }) => `/bills/${billId}/cycle-payments?year=${year}&month=${month}`,
      providesTags: ['MonthlyPayment'],
    }),

    getBillCycleHistory: builder.query({
      query: (billId) => `/bills/${billId}/cycle-history`,
      providesTags: ['MonthlyPayment'],
    }),

    payMonthlyCycle: builder.mutation({
      query: ({ billId, ...data }) => ({
        url: `/bills/${billId}/pay-cycle`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['MonthlyPayment'],
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

    // Transaction endpoints
    createTransaction: builder.mutation({
      query: (data) => ({
        url: '/transactions',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),

    getUserTransactions: builder.query({
      query: (userId) => `/transactions/user/${userId}`,
      providesTags: ['Transaction'],
    }),

    getTransactionInvitations: builder.query({
      query: (userId) => `/transactions/user/${userId}/invitations`,
      providesTags: ['Transaction'],
    }),

    respondToTransactionSplit: builder.mutation({
      query: ({ transactionId, ...data }) => ({
        url: `/transactions/${transactionId}/respond`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),

    resendTransactionInvitation: builder.mutation({
      query: ({ transactionId, participantUserId, ...data }) => ({
        url: `/transactions/${transactionId}/participants/${participantUserId}/resend`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),

    deleteTransaction: builder.mutation({
      query: ({ transactionId, ...data }) => ({
        url: `/transactions/${transactionId}`,
        method: 'DELETE',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),

    updateTransactionParticipants: builder.mutation({
      query: ({ transactionId, ...data }) => ({
        url: `/transactions/${transactionId}/participants`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),

    markTransactionPaid: builder.mutation({
      query: ({ transactionId, ...data }) => ({
        url: `/transactions/${transactionId}/mark-paid`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),

    markParticipantPaid: builder.mutation({
      query: ({ transactionId, participantUserId, ...data }) => ({
        url: `/transactions/${transactionId}/participants/${participantUserId}/mark-paid`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Transaction'],
    }),

    markTransactionCyclePaid: builder.mutation({
      query: ({ transactionId, year, month, user_id }) => ({
        url: `/transactions/${transactionId}/cycles/${year}/${month}/mark-paid`,
        method: 'POST',
        body: { user_id },
      }),
      invalidatesTags: ['Transaction'],
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

    // Friend endpoints
    getFriends: builder.query({
      query: (userId) => `/friends/${userId}`,
      providesTags: ['Friend'],
    }),

    getPendingRequests: builder.query({
      query: (userId) => `/friends/${userId}/pending`,
      providesTags: ['Friend'],
    }),

    getSentRequests: builder.query({
      query: (userId) => `/friends/${userId}/sent`,
      providesTags: ['Friend'],
    }),

    searchNonFriends: builder.query({
      query: ({ userId, searchTerm }) => `/friends/${userId}/search?q=${searchTerm}`,
      providesTags: ['Friend'],
    }),

    sendFriendRequest: builder.mutation({
      query: (data) => ({
        url: '/friends/request',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Friend'],
    }),

    respondToFriendRequest: builder.mutation({
      query: (data) => ({
        url: '/friends/respond',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Friend'],
    }),

    removeFriend: builder.mutation({
      query: (friendshipId) => ({
        url: `/friends/${friendshipId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Friend'],
    }),
  }),
});

export const {
  useSyncUserMutation,
  useCreateBillMutation,
  useGetUserCreatedBillsQuery,
  useGetUserInvitedBillsQuery,
  useGetUserParticipatingBillsQuery,
  useGetBillDetailsQuery,
  useInviteUsersToBillMutation,
  useRespondToBillInvitationMutation,
  useFinalizeBillMutation,
  useMarkBillAsPaidMutation,
  useDeleteBillMutation,
  usePayBillInFullMutation,
  useReopenBillMutation,
  useStartMonthlyBillCycleMutation,
  useGetMonthlyPaymentsQuery,
  useGetBillCyclePaymentsQuery,
  useGetBillCycleHistoryQuery,
  usePayMonthlyCycleMutation,
  useCreateTransactionMutation,
  useGetUserTransactionsQuery,
  useDeleteTransactionMutation,
  useGetTransactionInvitationsQuery,
  useRespondToTransactionSplitMutation,
  useResendTransactionInvitationMutation,
  useUpdateTransactionParticipantsMutation,
  useMarkTransactionPaidMutation,
  useMarkParticipantPaidMutation,
  useMarkTransactionCyclePaidMutation,
  useSearchUsersQuery,
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
  useGetBillStatusQuery,
  useGetFriendsQuery,
  useGetPendingRequestsQuery,
  useGetSentRequestsQuery,
  useSearchNonFriendsQuery,
  useSendFriendRequestMutation,
  useRespondToFriendRequestMutation,
  useRemoveFriendMutation,
} = api;
