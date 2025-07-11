import { configureStore } from '@reduxjs/toolkit';
import { api } from './services/api';

const store = configureStore({
  reducer: {
    // Add the api reducer to the store
    [api.reducerPath]: api.reducer,
  },
  // Adding the api middleware enables caching, invalidation, polling, and other features of RTK Query
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

export default store;