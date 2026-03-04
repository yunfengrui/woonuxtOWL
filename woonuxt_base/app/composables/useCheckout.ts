import type { CheckoutInput, CreateAccountInput, UpdateCustomerInput } from '#types/gql';

export function useCheckout() {
  const { customer, loginUser } = useAuth();
  const { cart, emptyCart, refreshCart, isUpdatingCart } = useCart();

  const orderInput = useState<any>('orderInput', () => {
    return {
      customerNote: '',
      paymentMethod: '',
      shipToDifferentAddress: false,
      metaData: [{ key: 'order_via', value: 'WooNuxt' }],
    };
  });

  const isProcessingOrder = useState<boolean>('isProcessingOrder', () => false);

  // Helper function to build checkout payload
  const buildCheckoutPayload = (isPaid = false): CheckoutInput => {
    const { username, password, shipToDifferentAddress } = orderInput.value;
    const shippingSource = customer.value?.shipping ?? customer.value?.billing;
    const billingSource = shipToDifferentAddress ? customer.value?.billing : shippingSource;
    const billing = billingSource;
    const shipping = shipToDifferentAddress ? shippingSource : billingSource;

    const payload: CheckoutInput = {
      billing,
      shipping,
      shippingMethod: cart.value?.chosenShippingMethods,
      metaData: orderInput.value.metaData,
      paymentMethod: orderInput.value.paymentMethod.id,
      customerNote: orderInput.value.customerNote,
      shipToDifferentAddress,
      transactionId: orderInput.value.transactionId,
      isPaid,
    };

    // Handle account creation
    if (orderInput.value.createAccount) {
      payload.account = { username, password } as CreateAccountInput;
    } else {
      payload.account = null;
    }

    return payload;
  };

  // Helper function to check if payment method is PayPal
  const isPayPalPayment = (): boolean => {
    const paymentId = orderInput.value.paymentMethod.id;
    return paymentId === 'paypal' || paymentId === 'ppcp-gateway';
  };

  // Helper function to handle PayPal redirect
  const handlePayPalRedirect = async (checkout: any, orderId: string, orderKey: string): Promise<void> => {
    const { replaceQueryParam } = useHelpers();
    const router = useRouter();

    const frontEndUrl = window.location.origin;
    let redirectUrl = checkout?.redirect ?? '';

    const payPalReturnUrl = `${frontEndUrl}/checkout/order-received/${orderId}/?key=${orderKey}&from_paypal=true`;
    const payPalCancelUrl = `${frontEndUrl}/checkout/?cancel_order=true&from_paypal=true`;

    redirectUrl = replaceQueryParam('return', payPalReturnUrl, redirectUrl);
    redirectUrl = replaceQueryParam('cancel_return', payPalCancelUrl, redirectUrl);
    redirectUrl = replaceQueryParam('bn', 'WooNuxt_Cart', redirectUrl);

    const isPayPalWindowClosed = await openPayPalWindow(redirectUrl);

    if (isPayPalWindowClosed) {
      router.push(`/checkout/order-received/${orderId}/?key=${orderKey}&fetch_delay=true`);
    }
  };

  // Helper function to handle post-checkout account creation
  const handleAccountCreation = async (): Promise<void> => {
    if (orderInput.value.createAccount) {
      const { username, password } = orderInput.value;
      await loginUser({ username, password });
    }
  };

  // Helper function to finalize checkout
  const finalizeCheckout = async (checkout: any): Promise<void> => {
    // For PayPal payments, clear the cart here since they handle redirect differently
    // Only clear if cart has items to avoid "Cart is empty" errors
    if (isPayPalPayment() && cart.value?.contents?.nodes?.length) {
      await emptyCart();
      await refreshCart();
      return;
    }

    // For other payment methods, don't clear cart here to avoid flash
    // Cart will be cleared on the order-received page
    if (checkout?.result !== 'success' && !checkout?.order?.databaseId) {
      alert('There was an error processing your order. Please try again.');
      window.location.reload();
    }
  };

  // if Country or State are changed, calculate the shipping rates again
  async function updateShippingLocation() {
    isUpdatingCart.value = true;

    try {
      const pickLocation = (address: any) => {
        if (!address) return {};
        const { address1, address2, city, country, postcode, state } = address;
        return { address1, address2, city, country, postcode, state };
      };

      const shippingSource = customer.value?.shipping ?? customer.value?.billing;
      const billingSource = orderInput.value.shipToDifferentAddress ? customer.value?.billing : shippingSource;

      if (!orderInput.value.shipToDifferentAddress && customer.value?.billing && shippingSource) {
        Object.assign(customer.value.billing, {
          ...shippingSource,
          email: customer.value.billing.email,
        });
      }

      const shipping = pickLocation(shippingSource);
      const billing = pickLocation(billingSource);

      const { updateCustomer } = await GqlUpdateCustomer({
        input: {
          shipping,
          billing,
        } as UpdateCustomerInput,
      });

      if (!updateCustomer) {
        console.warn('[updateShippingLocation] updateCustomer returned null/false');
      }

      await refreshCart();
    } catch (error) {
      console.error('Error updating shipping location:', error);
    } finally {
      isUpdatingCart.value = false;
    }
  }

  async function openPayPalWindow(redirectUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      const width = 750;
      const height = 750;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2 + 80;
      const payPalWindow = window.open(redirectUrl, '', `width=${width},height=${height},top=${top},left=${left}`);
      const timer = setInterval(() => {
        if (payPalWindow && payPalWindow.closed) {
          clearInterval(timer);
          resolve(true);
        }
      }, 500);
    });
  }

  function extractOrderFromRedirect(redirectUrl?: string): { orderId?: number; orderKey?: string } {
    if (!redirectUrl) return {};
    try {
      const url = new URL(redirectUrl);
      const custom = url.searchParams.get('custom');
      if (custom) {
        try {
          const data = JSON.parse(decodeURIComponent(custom));
          const id = Number(data?.order_id);
          const key = typeof data?.order_key === 'string' ? data.order_key : undefined;
          if (id && key) return { orderId: id, orderKey: key };
        } catch {}
      }
      const ret = url.searchParams.get('return');
      if (ret) {
        try {
          const rtn = new URL(decodeURIComponent(ret));
          const parts = rtn.pathname.split('/');
          let id: number | undefined;
          for (let i = 0; i < parts.length; i++) {
            if (parts[i] === 'order-received' && i + 1 < parts.length) {
              const num = Number(parts[i + 1]);
              if (!Number.isNaN(num)) {
                id = num;
              }
              break;
            }
          }
          const key = rtn.searchParams.get('key') || undefined;
          if (id && key) return { orderId: id, orderKey: key };
        } catch {}
      }
      const cancelRet = url.searchParams.get('cancel_return');
      if (cancelRet) {
        try {
          const cr = new URL(decodeURIComponent(cancelRet));
          const id = Number(cr.searchParams.get('order_id'));
          const key = cr.searchParams.get('order') || undefined;
          if (id && key) return { orderId: id, orderKey: key };
        } catch {}
      }
    } catch {}
    return {};
  }

  const processCheckout = async (isPaid = false): Promise<any> => {
    const router = useRouter();

    isProcessingOrder.value = true;

    try {
      // Build checkout payload
      const checkoutPayload = buildCheckoutPayload(isPaid);

      // Process the checkout
      const { checkout } = await GqlCheckout(checkoutPayload);

      // Handle account creation if requested
      await handleAccountCreation();

      let orderId = checkout?.order?.databaseId as number | undefined;
      let orderKey = checkout?.order?.orderKey as string | undefined;
      if ((!orderId || !orderKey) && checkout?.redirect) {
        const extracted = extractOrderFromRedirect(checkout.redirect);
        orderId = orderId ?? extracted.orderId;
        orderKey = orderKey ?? extracted.orderKey;
      }

      // Ensure we have required order details
      if (!orderId || !orderKey) {
        throw new Error('Order ID or order key is missing from checkout response');
      }

      // Handle PayPal redirect if needed
      if (checkout?.redirect && isPayPalPayment()) {
        await handlePayPalRedirect(checkout, String(orderId), orderKey);
      } else {
        // Standard redirect to order received page
        router.push(`/checkout/order-received/${orderId}/?key=${orderKey}`);
      }

      // Finalize the checkout (this will also clear cart for PayPal)
      await finalizeCheckout(checkout);

      return checkout;
    } catch (error: unknown) {
      console.error('Checkout error:', error);
      if (error instanceof Error && error.message) alert(error.message);
      return null;
    } finally {
      isProcessingOrder.value = false;
    }
  };

  return {
    orderInput,
    isProcessingOrder,
    processCheckout,
    updateShippingLocation,
  };
}
