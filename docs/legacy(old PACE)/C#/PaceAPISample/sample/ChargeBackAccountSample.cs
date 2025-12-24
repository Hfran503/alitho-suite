using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;
using System.Web.Services.Protocols;

namespace Pace_Web_Service_SDK.sample
{
    class ChargeBackAccountSample
    {
        public static void Run()
        {
            Console.WriteLine("Charge Back Account Sample is selected");
            Console.WriteLine("Enter the customer Id");
            String customerId = Console.ReadLine();

            Console.WriteLine("Enter the Charge bank account number");
            String chargeBankAccountNumber = Console.ReadLine();

            CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
            ReadObjectPortType readObjectHttpBinding = PaceClient.getReadObjectHttpBinding();
            UpdateObjectPortType updateObjectHttpBinding = PaceClient.getUpdateObjectHttpBinding();
            CloneObjectPortType cloneObjectHttpBinding = PaceClient.getCloneObjectHttpBinding();
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            if (verifyCustomerExists(customerId, readObjectHttpBinding))
            {
                ArrayOfString keys = findObjectsHttpBinding.find("ChargeBackAccount", "@accountNumber = '" + chargeBankAccountNumber + "'");
                ChargeBackAccount chargeBackAccount = new ChargeBackAccount();

                if (keys.Count == 1)
                {
                    // read existing account since accountNumber is unique
                    chargeBackAccount.id = Convert.ToInt32(keys[0]);
                    chargeBackAccount = readObjectHttpBinding.readChargeBackAccount(chargeBackAccount);

                    Console.WriteLine("Found existing ChargeBackAccount[" + chargeBackAccount.id + "] acct number= " + chargeBackAccount.accountNumber + ", customer=" + chargeBackAccount.customer + ", expires= " + chargeBackAccount.expirationDate);
                }
                else
                {
                    chargeBackAccount.accountNumber = chargeBankAccountNumber;
                    chargeBackAccount.customer = customerId;
                    chargeBackAccount.expirationDate = System.DateTime.Now;
                    chargeBackAccount = createObjectHttpBinding.createChargeBackAccount(chargeBackAccount);
                    Console.WriteLine( "Created new ChargeBackAccount["+chargeBackAccount.id+"] acct number= "+chargeBackAccount.accountNumber+", customer="+chargeBackAccount.customer+", expires= "+chargeBackAccount.expirationDate);
                }

                // if the current year = the same year as the expiration date, then let's extend it for a year.
                if(chargeBackAccount.expirationDate.HasValue)
                {
                    if(chargeBackAccount.expirationDate.Value.Year == DateTime.Now.Year)
                    {
                        chargeBackAccount.expirationDate = chargeBackAccount.expirationDate.Value.AddYears(1);
                        
                        updateObjectHttpBinding.updateChargeBackAccount(chargeBackAccount);
                        Console.WriteLine("Extended expiration date by 1 year");
                    }
                }
            }
        }

        private static Boolean verifyCustomerExists(String customerId, ReadObjectPortType readObjectHttpBinding)
        {
            try
            {
                Customer customer = new Customer();
                customer.id = customerId;
                readObjectHttpBinding.readCustomer(customer);
                return true;
            }
            catch (SoapException exception)
            {
                Console.WriteLine("Customer: " + customerId + " does not exist. Please submit a valid customer code." + exception.Message );
                return false;
            }
        }
    }
}
