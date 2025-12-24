using System;
using System.Collections.Generic;
using System.Text;
using System.Net;
using System.ServiceModel;
using System.ServiceModel.Description;
using System.ServiceModel.Channels;
using efipaceservices;

namespace Pace_Web_Service_SDK
{
    class PaceClient
    {
        public static Uri getServiceUrl( String serviceName )
        {
            string scheme = SDK.PORT == 443 ? "https://" : "http://";
            string baseURL = scheme + SDK.HOST + ":" + SDK.PORT + "/rpc/services/" + serviceName;

            return new System.Uri(baseURL);
        }

        public static void setupHttpHeader( IClientChannel serviceChannel )
        {
            using (new OperationContextScope( serviceChannel ))
            {
                // Add a HTTP Header to an outgoing request
                HttpRequestMessageProperty requestMessage = new HttpRequestMessageProperty();
                requestMessage.Headers["Authorization"] = "Basic " + System.Convert.ToBase64String(Encoding.UTF8.GetBytes(SDK.USERNAME + ":" + SDK.PASSWORD));
                OperationContext.Current.OutgoingMessageProperties[HttpRequestMessageProperty.Name] = requestMessage;
            }
        }

        public static ReadObjectPortType getReadObjectHttpBinding()
        {
            ReadObjectPortTypeClient servicePort = new ReadObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl( "ReadObject" );

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel );
            return servicePort;
        }

        public static CreateObjectPortType getCreateObjectHttpBinding()
        {
            CreateObjectPortTypeClient servicePort = new CreateObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static UpdateObjectPortType getUpdateObjectHttpBinding()
        {
            UpdateObjectPortTypeClient servicePort = new UpdateObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static FindObjectsPortType getFindObjectsHttpBinding()
        {
            FindObjectsPortTypeClient servicePort = new FindObjectsPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static InvokeProcessPortType getInvokeProcessHttpBinding()
        {
            InvokeProcessPortTypeClient servicePort = new InvokeProcessPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static VersionPortType getVersionHttpBinding()
        {
            VersionPortTypeClient servicePort = new VersionPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static DeleteObjectPortType getDeleteObjectHttpBinding()
        {
            DeleteObjectPortTypeClient servicePort = new DeleteObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }


        public static CloneObjectPortType getCloneObjectHttpBinding()
        {
            CloneObjectPortTypeClient servicePort = new CloneObjectPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static InvokeActionPortType getInvokeActionHttpBinding()
        {
            InvokeActionPortTypeClient servicePort = new InvokeActionPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static GeoLocatePortType getGeoLocateHttpBinding()
        {
            GeoLocatePortTypeClient servicePort = new GeoLocatePortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static InvokePaceConnectPortType getInvokePaceConnectHttpBinding()
        {
            InvokePaceConnectPortTypeClient servicePort = new InvokePaceConnectPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static SystemInspectorPortType getSystemInspectorHttpBinding()
        {
            SystemInspectorPortTypeClient servicePort = new SystemInspectorPortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static AttachmentServicePortType getAttachmentServiceHttpBinding()
        {
            AttachmentServicePortTypeClient servicePort = new AttachmentServicePortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static TransactionServicePortTypeClient getTransactionServiceConnectHttpBinding(TransactionServicePortTypeClient servicePort )
        {
            servicePort.Endpoint.ListenUri = getServiceUrl("TransactionService");
            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

        public static ReportServicePortType getReportServiceHttpBinding()
        {
            ReportServicePortTypeClient servicePort = new ReportServicePortTypeClient();

            servicePort.Endpoint.ListenUri = getServiceUrl("ReadObject");

            servicePort.ClientCredentials.UserName.UserName = SDK.USERNAME;
            servicePort.ClientCredentials.UserName.Password = SDK.PASSWORD;

            setupHttpHeader(servicePort.InnerChannel);
            return servicePort;
        }

    }
}
