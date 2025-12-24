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


        public static CloneObjectHttpBinding getCloneObjectHttpBinding()
        {
            CloneObjectHttpBinding cloneObjectHttpBinding = new CloneObjectHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/CloneObject";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            cloneObjectHttpBinding.Url = baseURL;
            cloneObjectHttpBinding.Credentials = credential;

            return cloneObjectHttpBinding;
        }

        public static InvokeActionHttpBinding getInvokeActionHttpBinding()
        {
            InvokeActionHttpBinding invokeActionHttpBinding = new InvokeActionHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/InvokeAction";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            invokeActionHttpBinding.Url = baseURL;
            invokeActionHttpBinding.Credentials = credential;

            return invokeActionHttpBinding;
        }

        public static GeoLocateHttpBinding getGeoLocateHttpBinding()
        {
            GeoLocateHttpBinding geoLocateHttpBinding = new GeoLocateHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/GeoLocate";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            geoLocateHttpBinding.Url = baseURL;
            geoLocateHttpBinding.Credentials = credential;

            return geoLocateHttpBinding;
        }

        public static InvokePaceConnectHttpBinding getInvokePaceConnectHttpBinding()
        {
            InvokePaceConnectHttpBinding invokePaceConnectHttpBinding = new InvokePaceConnectHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/InvokePaceConnect";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            invokePaceConnectHttpBinding.Url = baseURL;
            invokePaceConnectHttpBinding.Credentials = credential;

            return invokePaceConnectHttpBinding;
        }

        public static SystemInspectorHttpBinding getSystemInspectorHttpBinding()
        {
            SystemInspectorHttpBinding systemInspectorHttpBinding = new SystemInspectorHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/SystemInspector";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            systemInspectorHttpBinding.Url = baseURL;
            systemInspectorHttpBinding.Credentials = credential;
            return systemInspectorHttpBinding;
        }

        public static AttachmentServiceHttpBinding getAttachmentServiceHttpBinding()
        {
            AttachmentServiceHttpBinding attachmentServiceHttpBinding = new AttachmentServiceHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/AttachmentService";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            attachmentServiceHttpBinding.Url = baseURL;
            attachmentServiceHttpBinding.Credentials = credential;
            return attachmentServiceHttpBinding;
        }

        public static ReportServiceHttpBinding getReportServiceHttpBinding()
        {
            ReportServiceHttpBinding reportServiceHttpBinding = new ReportServiceHttpBinding();
            string baseURL = "http://" + SDK.HOST + ":" + SDK.PORT + "/rpc/services/ReportService";
            NetworkCredential credential = new NetworkCredential(SDK.USERNAME, SDK.PASSWORD);
            reportServiceHttpBinding.Url = baseURL;
            reportServiceHttpBinding.Credentials = credential;
            return reportServiceHttpBinding;
        }


    }
}
