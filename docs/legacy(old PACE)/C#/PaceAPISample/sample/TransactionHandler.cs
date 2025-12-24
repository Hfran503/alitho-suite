using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Pace_Web_Service_SDK.sample
{
    public class StartTransactionBehavior : System.ServiceModel.Description.IEndpointBehavior
    {

        public StartTransactionInspector startTransactionInspector;

        public StartTransactionBehavior(String txnId, String process)
        {
            startTransactionInspector = new StartTransactionInspector( txnId, process );
        }

        public string LastRequestXML
        {
            get
            {
                return startTransactionInspector.LastRequestXML;
            }
        }

        public string LastResponseXML
        {
            get
            {
                return startTransactionInspector.LastResponseXML;
            }
        }


        
        public void AddBindingParameters(System.ServiceModel.Description.ServiceEndpoint endpoint, System.ServiceModel.Channels.BindingParameterCollection bindingParameters)
        {
            
        }

        public void ApplyDispatchBehavior(System.ServiceModel.Description.ServiceEndpoint endpoint, System.ServiceModel.Dispatcher.EndpointDispatcher endpointDispatcher)
        {

        }

        public void Validate(System.ServiceModel.Description.ServiceEndpoint endpoint)
        {

        }


        public void ApplyClientBehavior(System.ServiceModel.Description.ServiceEndpoint endpoint, System.ServiceModel.Dispatcher.ClientRuntime clientRuntime)
        {

            clientRuntime.MessageInspectors.Add( startTransactionInspector );
        }

        
    }



    public class StartTransactionInspector : System.ServiceModel.Dispatcher.IClientMessageInspector
    {
        String txnId;
        String process;
        public StartTransactionInspector(String txnId, String process)
        {
            this.txnId = txnId;
            this.process = process;
        }
        public string LastRequestXML { get; private set; }
        public string LastResponseXML { get; private set; }
        public void AfterReceiveReply(ref System.ServiceModel.Channels.Message reply, object correlationState)
        {
           
            LastResponseXML = reply.ToString();
        }

        public object BeforeSendRequest(ref System.ServiceModel.Channels.Message request, System.ServiceModel.IClientChannel channel)
        {
            if( null != process )
            {
                System.ServiceModel.Channels.MessageHeader header = System.ServiceModel.Channels.MessageHeader.CreateHeader("process", "transaction", process );
                request.Headers.Add(header);
            }
            if ( null != txnId )
            {
                System.ServiceModel.Channels.MessageHeader header = System.ServiceModel.Channels.MessageHeader.CreateHeader("txnId", "transaction", txnId);
                request.Headers.Add(header);
            }
            return request;
        }
    }



}
