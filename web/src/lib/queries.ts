import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClient } from './client.ts';
import { config } from './config.ts';
import { isInsideTelegram } from './telegram.ts';
import type { ProductsQuery } from './types.ts';

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: async () => (await getClient()).getSettings() });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: async () => (await getClient()).getCategories() });
}

export function useBrands() {
  return useQuery({ queryKey: ['brands'], queryFn: async () => (await getClient()).getBrands() });
}

export function useRegions() {
  return useQuery({ queryKey: ['regions'], queryFn: async () => (await getClient()).getRegions() });
}

export function useBanners() {
  return useQuery({ queryKey: ['banners'], queryFn: async () => (await getClient()).getBanners() });
}

const PRODUCTS_PAGE_SIZE = 20;

export function useProductsInfinite(query: Omit<ProductsQuery, 'page'>) {
  return useInfiniteQuery({
    queryKey: ['products', query],
    queryFn: async ({ pageParam }) => (await getClient()).getProducts({ ...query, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * PRODUCTS_PAGE_SIZE;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}

export function useProductDetail(productId: number | null) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => (await getClient()).getProductById(productId as number),
    enabled: productId !== null,
  });
}

function canCallPrivate(): boolean {
  return config.mock || isInsideTelegram();
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: async () => (await getClient()).getMe(), enabled: canCallPrivate() });
}

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async () => (await getClient()).getFavorites(),
    enabled: canCallPrivate(),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, isFavorite }: { productId: number; isFavorite: boolean }) => {
      const client = await getClient();
      if (isFavorite) {
        await client.deleteFavorite(productId);
      } else {
        await client.putFavorite(productId);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await getClient()).getAddresses(),
    enabled: canCallPrivate(),
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await getClient()).getOrders(1),
    enabled: canCallPrivate(),
  });
}

export function useOrderDetail(orderId: number) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => (await getClient()).getOrderById(orderId),
    enabled: canCallPrivate() && Number.isFinite(orderId),
  });
}
