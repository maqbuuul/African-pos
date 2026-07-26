export const uiPackage = {
  name: '@hospitality-os/ui',
  status: 'foundation',
} as const

export { cn } from './lib/cn.js'

export { Button, type ButtonProps } from './components/Button.js'
export { Input, type InputProps } from './components/Input.js'
export { Card, CardHeader, CardBody } from './components/Card.js'
export { StatusBadge, type StatusBadgeProps, type StatusTone } from './components/StatusBadge.js'
export { Skeleton } from './components/Skeleton.js'
export { EmptyState, type EmptyStateProps } from './components/EmptyState.js'
export {
  ConnectivityIndicator,
  type ConnectivityIndicatorProps,
  type ConnectivityStatus,
} from './components/ConnectivityIndicator.js'
export { MetricTile, type MetricTileProps } from './components/MetricTile.js'
export { ConfirmDialog, type ConfirmDialogProps } from './components/ConfirmDialog.js'
export { Modal, type ModalProps } from './components/Modal.js'
export { ApprovalQueue, type ApprovalQueueProps, type ApprovalRequestItem } from './components/ApprovalQueue.js'
export { MenuCategoryTabs, type MenuCategoryTabsProps } from './components/MenuCategoryTabs.js'
export { ProductGrid, type ProductGridProps, type ProductGridItem } from './components/ProductGrid.js'
export { CartReview, type CartReviewProps, type CartReviewItem } from './components/CartReview.js'
