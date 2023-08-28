import { useState, useRef } from "react";
import styles from "./PaymentForm.module.css";
    
import {
  PayPalHostedFieldsProvider,
  PayPalHostedField,
  PayPalButtons,
  usePayPalHostedFields,
} from "@paypal/react-paypal-js";

async function createOrderCallback() {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // use the "body" param to optionally pass additional order information
        // like product ids and quantities
        body: JSON.stringify({
          cart: [
            {
              id: "YOUR_PRODUCT_ID",
              quantity: "YOUR_PRODUCT_QUANTITY",
            },
          ],
        }),
      });
  
      const orderData = await response.json();
  
      if (orderData.id) {
        return orderData.id;
      } else {
        const errorDetail = orderData?.details?.[0];
        const errorMessage = errorDetail
          ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
          : JSON.stringify(orderData);
  
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error(error);
      return `Could not initiate PayPal Checkout...<br><br>${error}`;
    }
  }

  async function onApproveCallback(data, actions) {
    try {
      const response = await fetch(`/api/orders/${data.orderID}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      const orderData = await response.json();
      // Three cases to handle:
      //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
      //   (2) Other non-recoverable errors -> Show a failure message
      //   (3) Successful transaction -> Show confirmation or thank you message
  
      const transaction =
        orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
        orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
      const errorDetail = orderData?.details?.[0];
  
      // this actions.restart() behavior only applies to the Buttons component
      if (errorDetail?.issue === "INSTRUMENT_DECLINED" && !data.card && actions) {
        // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
        // recoverable state, per https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
        return actions.restart();
      } else if (
        errorDetail ||
        !transaction ||
        transaction.status === "DECLINED"
      ) {
        // (2) Other non-recoverable errors -> Show a failure message
        let errorMessage;
        if (transaction) {
          errorMessage = `Transaction ${transaction.status}: ${transaction.id}`;
        } else if (errorDetail) {
          errorMessage = `${errorDetail.description} (${orderData.debug_id})`;
        } else {
          errorMessage = JSON.stringify(orderData);
        }
  
        throw new Error(errorMessage);
      } else {
        // (3) Successful transaction -> Show confirmation or thank you message
        // Or go to another URL:  actions.redirect('thank_you.html');
        console.log(
            "Capture result",
            orderData,
            JSON.stringify(orderData, null, 2),
          );
        return `Transaction ${transaction.status}: ${transaction.id}. See console for all available details`;
      }
    } catch (error) {
      return `Sorry, your transaction could not be processed...${error}`;
    }
  }

const SubmitPayment = ({onHandleMessage}) => {
    // Here declare the variable containing the hostedField instance
    const { cardFields } = usePayPalHostedFields();
    const cardHolderName = useRef(null);
    
    const submitHandler = () => {
      if (typeof cardFields.submit !== "function") return; // validate that \`submit()\` exists before using it
      //if (errorMsg) showErrorMsg(false);
      cardFields.submit({
        // The full name as shown in the card and billing addresss
        // These fields are optional for Sandbox but mandatory for production integration
        cardholderName: cardHolderName?.current?.value
      }).then(async(data) => onHandleMessage(await onApproveCallback(data)))
      .catch((orderData) => {
        onHandleMessage(
          `Sorry, your transaction could not be processed...${JSON.stringify(
            orderData,
          )}`,
        );
      });
      
    };

    return (
      <button onClick={submitHandler} className="btn btn-primary">Debit/Credit Pay</button>
    );
  };

const Message = ({ content }) => {
    return <p>{content}</p>;
}

export const PaymentForm = () => {
    const [message, setMessage] = useState('');
  return (
    <>
      <div className="row" align="center" style={{marginTop:"20px", marginBottom:"20px"}}>
      <PayPalButtons
          style={{
            shape: 'rect',
            //color:'blue' change the default color of the buttons
            layout: 'vertical', //default value. Can be changed to horizontal
          }}
          createOrder={createOrderCallback}
          onApprove={async (data)=> setMessage(await onApproveCallback(data))}
        />
      </div>
      
      <PayPalHostedFieldsProvider
        createOrder={createOrderCallback}
      > 
          <div className={styles.card_container}>
            <PayPalHostedField
              id="card-number"
              className={styles.card_field}
              hostedFieldType="number"
              options={{
                selector: "#card-number",
                placeholder: "Card Number"
              }}
            />

            <section style={{ display: "flex" }}>
              <div style={{ flexDirection: "column" }}>
                <PayPalHostedField
                  id="expiration-date"
                  hostedFieldType="expirationDate"
                  className={styles.card_field}
                  options={{
                    selector: "#expiration-date",
                    placeholder: "Expiration Date"
                  }}
                />
              </div>
              <div style={{ flexDirection: "column", marginLeft:"80px" }}>
                <PayPalHostedField
                  id="cvv"
                  hostedFieldType="cvv"
                  options={{
                    selector: "#cvv",
                    placeholder: "CVV"
                  }}
                  className={styles.card_field}
                />
              </div>
            </section>
              
            <input
              id="card-holder"
              className={styles.card_field}
              type="text"
              placeholder="Name on Card"
            />

            <input
              id="card-billing-address-country"
              className={styles.card_field}
              type="text"
              placeholder="Country Code"
            />

            <SubmitPayment onHandleMessage={setMessage} />
          </div>
        </PayPalHostedFieldsProvider>
        <Message content={message} />
      </>
  );
};