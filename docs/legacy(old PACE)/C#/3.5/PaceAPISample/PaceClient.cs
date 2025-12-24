using System;
using System.Collections.Generic;
using System.Text;
using System.Net;
using efipaceservices;

namespace Pace_Web_Service_SDK
{
    class PaceClient
    {

        public static ReadObjectHttpBinding getReadObjectHttpBinding()
        {
            ReadObjectHttpBinding readObjectHttpBinding = new ReadObjectHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/ReadObject";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            readObjectHttpBinding.Url = baseURL;
            readObjectHttpBinding.Credentials = credential;

            return readObjectHttpBinding;
        }

        public static CreateObjectHttpBinding getCreateObjectHttpBinding()
        {
            CreateObjectHttpBinding createObjectHttpBinding = new CreateObjectHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/CreateObject";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            createObjectHttpBinding.Url = baseURL;
            createObjectHttpBinding.Credentials = credential;

            return createObjectHttpBinding;
        }

        public static UpdateObjectHttpBinding getUpdateObjectHttpBinding()
        {
            UpdateObjectHttpBinding updateObjectHttpBinding = new UpdateObjectHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/UpdateObject";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            updateObjectHttpBinding.Url = baseURL;
            updateObjectHttpBinding.Credentials = credential;

            return updateObjectHttpBinding;
        }

        public static FindObjectsHttpBinding getFindObjectsHttpBinding()
        {
            FindObjectsHttpBinding findObjectsHttpBinding = new FindObjectsHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/FindObjects";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            findObjectsHttpBinding.Url = baseURL;
            findObjectsHttpBinding.Credentials = credential;

            return findObjectsHttpBinding;
        }

        public static InvokeProcessHttpBinding getInvokeProcessHttpBinding()
        {
            InvokeProcessHttpBinding invokeProcessHttpBinding = new InvokeProcessHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/InvokeProcess";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            invokeProcessHttpBinding.Url = baseURL;
            invokeProcessHttpBinding.Credentials = credential;

            return invokeProcessHttpBinding;
        }

        public static VersionHttpBinding getVersionHttpBinding()
        {
            VersionHttpBinding versionHttpBinding = new VersionHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/Version";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            versionHttpBinding.Url = baseURL;
            versionHttpBinding.Credentials = credential;

            return versionHttpBinding;
        }

        public static DeleteObjectHttpBinding getDeleteObjectHttpBinding()
        {
            DeleteObjectHttpBinding deleteObjectHttpBinding = new DeleteObjectHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/DeleteObject";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            deleteObjectHttpBinding.Url = baseURL;
            deleteObjectHttpBinding.Credentials = credential;

            return deleteObjectHttpBinding;
        }

        

        
        
    }
}
