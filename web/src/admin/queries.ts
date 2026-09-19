import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminClient } from './adminClient.ts';
import type { OrderStatus } from '../lib/types.ts';
import type {
  BannerFormInput,
  BrandFormInput,
  CategoryFormInput,
  ProductFormInput,
  RegionFormInput,
  SettingsFormInput,
  VariantFormInput,
} from './types.ts';

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function useAdminProducts(q: string, brandId: number | undefined, categoryId: number | undefined, page: number) {
  return useQuery({
    queryKey: ['admin', 'products', q, brandId ?? 'all', categoryId ?? 'all', page],
    queryFn: async () => (await getAdminClient()).getProducts({ q: q.length > 0 ? q : undefined, brandId, categoryId, page }),
  });
}

export function useAdminProduct(id: number | null) {
  return useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: async () => (await getAdminClient()).getProduct(id as number),
    enabled: id !== null,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductFormInput) => (await getAdminClient()).createProduct(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
  });
}

export function useUpdateProduct(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductFormInput) => (await getAdminClient()).updateProduct(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'product', id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await getAdminClient()).deleteProduct(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
  });
}

export function useImportProducts() {
  return useMutation({
    mutationFn: async ({ fileName, rows }: { fileName: string; rows: Record<string, unknown>[] }) =>
      (await getAdminClient()).importProducts(fileName, rows),
  });
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export function useAdminVariants(productId: number | null) {
  return useQuery({
    queryKey: ['admin', 'variants', productId],
    queryFn: async () => (await getAdminClient()).getVariants(productId as number),
    enabled: productId !== null,
  });
}

export function useCreateVariant(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VariantFormInput) => (await getAdminClient()).createVariant(productId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'variants', productId] }),
  });
}

// id is passed at call time (mutate({ id, input })), not bound when the hook
// is created — VariantsList renders a variable number of rows and calls this
// once per edit, so binding a single variantId at hook-creation time (like
// XUMO's per-resource product hooks do) would not fit a list of many rows.
export function useUpdateVariant(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: VariantFormInput }) => (await getAdminClient()).updateVariant(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'variants', productId] }),
  });
}

export function useDeleteVariant(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await getAdminClient()).deleteVariant(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'variants', productId] }),
  });
}

export function useUploadVariantImage(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, thumb, main }: { id: number; thumb: Blob; main: Blob }) =>
      (await getAdminClient()).uploadVariantImage(id, thumb, main),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'variants', productId] }),
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => (await getAdminClient()).getCategories(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryFormInput) => (await getAdminClient()).createCategory(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<CategoryFormInput> }) =>
      (await getAdminClient()).updateCategory(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await getAdminClient()).deleteCategory(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
  });
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export function useAdminBrands() {
  return useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: async () => (await getAdminClient()).getBrands(),
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BrandFormInput) => (await getAdminClient()).createBrand(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: BrandFormInput }) => (await getAdminClient()).updateBrand(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await getAdminClient()).deleteBrand(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
  });
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export function useAdminRegions() {
  return useQuery({
    queryKey: ['admin', 'regions'],
    queryFn: async () => (await getAdminClient()).getRegions(),
  });
}

export function useCreateRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegionFormInput) => (await getAdminClient()).createRegion(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'regions'] }),
  });
}

export function useUpdateRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: RegionFormInput }) => (await getAdminClient()).updateRegion(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'regions'] }),
  });
}

export function useDeleteRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await getAdminClient()).deleteRegion(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'regions'] }),
  });
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

export function useAdminBanners() {
  return useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: async () => (await getAdminClient()).getBanners(),
  });
}

export function useCreateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BannerFormInput) => (await getAdminClient()).createBanner(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] }),
  });
}

export function useUpdateBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<BannerFormInput> }) =>
      (await getAdminClient()).updateBanner(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] }),
  });
}

export function useDeleteBanner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await getAdminClient()).deleteBanner(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] }),
  });
}

export function useUploadBannerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, image }: { id: number; image: Blob }) => (await getAdminClient()).uploadBannerImage(id, image),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] }),
  });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export function useAdminOrders(status: OrderStatus | undefined, regionId: number | undefined, page: number) {
  return useQuery({
    queryKey: ['admin', 'orders', status ?? 'all', regionId ?? 'all', page],
    queryFn: async () => (await getAdminClient()).getOrders({ status, regionId, page }),
  });
}

export function useAdminOrder(id: number) {
  return useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: async () => (await getAdminClient()).getOrder(id),
    enabled: Number.isFinite(id),
  });
}

export function useSetOrderStatus(orderId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ status, trackingNote }: { status: OrderStatus; trackingNote: string | null }) =>
      (await getAdminClient()).setOrderStatus(orderId, status, trackingNote),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await getAdminClient()).getSettings(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SettingsFormInput) => (await getAdminClient()).updateSettings(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: async () => (await getAdminClient()).getAdmins(),
  });
}

export function useAddAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (telegramId: number) => (await getAdminClient()).addAdmin(telegramId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (telegramId: number) => (await getAdminClient()).deleteAdmin(telegramId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  });
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export function useAdminAudit(page: number) {
  return useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: async () => (await getAdminClient()).getAudit(page),
  });
}
