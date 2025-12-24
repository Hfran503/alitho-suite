using System;
using System.Web.Services.Protocols;

using efipaceservices;
using Pace_Web_Service_SDK.sample;

namespace Pace_Web_Service_SDK
{

    public class TransactionSample
    {
        public static String txnId;

        public static ReadObjectPortType getReadObjectHttpBinding( StartTransactionBehavior x)
        {
            ReadObjectPortTypeClient servicePort = new ReadObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = PaceClient.getServiceUrl("ReadObject");
            if( null != x )
            servicePort.Endpoint.Behaviors.Add(x);
            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            PaceClient.setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static CreateObjectPortType getCreateObjectHttpBinding(StartTransactionBehavior x)
        {
            CreateObjectPortTypeClient servicePort = new CreateObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = PaceClient.getServiceUrl("ReadObject");
            servicePort.Endpoint.Behaviors.Add(x);
            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            PaceClient.setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static UpdateObjectPortType getUpdateObjectHttpBinding(StartTransactionBehavior x)
        {
            UpdateObjectPortTypeClient servicePort = new UpdateObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = PaceClient.getServiceUrl("ReadObject");
            servicePort.Endpoint.Behaviors.Add(x);
            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            PaceClient.setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static DeleteObjectPortType getDeleteObjectHttpBinding(StartTransactionBehavior x)
        {
            DeleteObjectPortTypeClient servicePort = new DeleteObjectPortTypeClient();
            servicePort.Endpoint.Behaviors.Add(x);
            servicePort.Endpoint.ListenUri = PaceClient.getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            PaceClient.setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }
        public static void Run()
        {
            TransactionServicePortTypeClient servicePort = new TransactionServicePortTypeClient();
            var startTxnInterceptor = new Pace_Web_Service_SDK.sample.StartTransactionBehavior( null, "startTransaction");
            servicePort.Endpoint.Behaviors.Add(startTxnInterceptor);
            servicePort.Endpoint.ListenUri = PaceClient.getServiceUrl("TransactionService");
            servicePort = PaceClient.getTransactionServiceConnectHttpBinding(servicePort);

            txnId = servicePort.startTransaction(1);
            Console.WriteLine("Success ! Transaction started - " + txnId);
            var txnInterceptor = new Pace_Web_Service_SDK.sample.StartTransactionBehavior(txnId , null);
            CreateObjectPortType createObjectHttpBinding = getCreateObjectHttpBinding(txnInterceptor );
            UpdateObjectPortType updateObjectHttpBinding = getUpdateObjectHttpBinding(txnInterceptor );
            DeleteObjectPortType deleteObjectHttpBinding = getDeleteObjectHttpBinding(txnInterceptor );
            ReadObjectPortType readObjectHttpBinding = getReadObjectHttpBinding(txnInterceptor);
            Customer customer = new Customer();
            try
            {
                    Console.WriteLine(" Provide customer Id ");
                    customer.id = Console.ReadLine();
                    customer.custName = customer.id;
                    customer = createObjectHttpBinding.createCustomer(customer);
                    Console.WriteLine( " Created Customer - " + readObjectHttpBinding.readCustomer(customer).custName);

                    customer.address1 = "updated address - " + customer.custName;
                    customer = updateObjectHttpBinding.updateCustomer(customer);
                    Console.WriteLine(" Updated Customer address - " + readObjectHttpBinding.readCustomer(customer).address1);

                    Console.WriteLine(" Read Customer in transasction - Found : " + readObjectHttpBinding.readCustomer(customer).custName);

                    try
                    {
                        readObjectHttpBinding = getReadObjectHttpBinding(null);
                        Console.WriteLine(" Read Customer out txn passed - " + readObjectHttpBinding.readCustomer(customer).custName);
                    }
                    catch( Exception e )
                    {
                        Console.WriteLine(" Reading Customer outside transaction - Not Found : " + e.Message);
                    }

                    deleteObjectHttpBinding.deleteObject("Customer", customer.id);
                    Console.WriteLine(" Customer deleted - " + customer.id);

                    servicePort = new TransactionServicePortTypeClient();
                    var startTxnInterceptor1 = new Pace_Web_Service_SDK.sample.StartTransactionBehavior(txnId, "commit");
                    servicePort.Endpoint.Behaviors.Add(startTxnInterceptor1);
                    servicePort.Endpoint.ListenUri = PaceClient.getServiceUrl("TransactionService");
                    servicePort = PaceClient.getTransactionServiceConnectHttpBinding(servicePort);
                    servicePort.commit();
                    Console.WriteLine(" Transaction committed successfully- " + txnId);
            }
            catch( Exception e )
            {
                Console.WriteLine("Transaction rolled back.");
                servicePort = new TransactionServicePortTypeClient();
                var startTxnInterceptor2 = new Pace_Web_Service_SDK.sample.StartTransactionBehavior(txnId, "rollback");
                servicePort.Endpoint.Behaviors.Add(startTxnInterceptor2);
                servicePort.Endpoint.ListenUri = PaceClient.getServiceUrl("TransactionService");
                servicePort = PaceClient.getTransactionServiceConnectHttpBinding(servicePort);
                servicePort.rollback();
            }
        }
    }
}