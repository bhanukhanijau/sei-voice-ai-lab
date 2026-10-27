import Lab from "@/components/lab";
import { orders } from "@/lib/business";
export default function Page() {
  return (
    <Lab
      orderReference={orders.map(({ order_number, status, product }) => ({
        order_number,
        status,
        product,
      }))}
    />
  );
}
