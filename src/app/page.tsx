import Lab from "@/components/lab";
import { orders, products } from "@/lib/business";
export default function Page() {
  return (
    <Lab
      productReference={products.map(({ product_name, variants }) => ({
        product_name,
        variants,
      }))}
      orderReference={orders.map(({ order_number, status, product }) => ({
        order_number,
        status,
        product,
      }))}
    />
  );
}
