import { IsUUID } from 'class-validator'

// Shared by endpoints whose whole body is just the order being acted on
// (request-bill, pay-with-waiter).
export class OrderIdDto {
  @IsUUID()
  orderId!: string
}
