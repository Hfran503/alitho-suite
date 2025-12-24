Imports System.Net
Imports PaceWebServiceSDK.efipaceservices.samplecompany

Public Class PaceClientCompanySample

    Public Shared Function getCreateObjectHttpBinding() As CreateObjectHttpBinding
        Dim createObjectHttpBinding As New CreateObjectHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/CreateObject"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        createObjectHttpBinding.Url = baseURL
        createObjectHttpBinding.Credentials = credential
        Return createObjectHttpBinding
    End Function

    Public Shared Function getReadObjectHttpBinding() As ReadObjectHttpBinding
        Dim readObjectHttpBinding As New ReadObjectHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/ReadObject"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        readObjectHttpBinding.Url = baseURL
        readObjectHttpBinding.Credentials = credential
        Return readObjectHttpBinding
    End Function

    Public Shared Function getUpdateObjectHttpBinding() As UpdateObjectHttpBinding
        Dim updateObjectHttpBinding As New UpdateObjectHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/UpdateObject"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        updateObjectHttpBinding.Url = baseURL
        updateObjectHttpBinding.Credentials = credential
        Return updateObjectHttpBinding
    End Function

    Public Shared Function getCloneObjectHttpBinding() As CloneObjectHttpBinding
        Dim cloneObjectHttpBinding As New CloneObjectHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/CloneObject"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        cloneObjectHttpBinding.Url = baseURL
        cloneObjectHttpBinding.Credentials = credential
        Return cloneObjectHttpBinding
    End Function

    Public Shared Function getFindObjectsHttpBinding() As FindObjectsHttpBinding
        Dim findObjectsHttpBinding As New FindObjectsHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/FindObjects"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        findObjectsHttpBinding.Url = baseURL
        findObjectsHttpBinding.Credentials = credential
        Return findObjectsHttpBinding
    End Function

    Public Shared Function getDeleteObjectHttpBinding() As DeleteObjectHttpBinding
        Dim deleteObjectsHttpBinding As New DeleteObjectHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/DeleteObject"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        deleteObjectsHttpBinding.Url = baseURL
        deleteObjectsHttpBinding.Credentials = credential
        Return deleteObjectsHttpBinding
    End Function

    Public Shared Function getInvokeActionHttpBinding() As InvokeActionHttpBinding
        Dim invokeActionHttpBinding As New InvokeActionHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/InvokeAction"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        invokeActionHttpBinding.Url = baseURL
        invokeActionHttpBinding.Credentials = credential
        Return invokeActionHttpBinding
    End Function

    Public Shared Function getInvokeProcessHttpBinding() As InvokeProcessHttpBinding
        Dim invokeProcessHttpBinding As New InvokeProcessHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/InvokeProcess"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        invokeProcessHttpBinding.Url = baseURL
        invokeProcessHttpBinding.Credentials = credential
        Return invokeProcessHttpBinding
    End Function

    Public Shared Function getGeoLocateHttpBinding() As GeoLocateHttpBinding
        Dim geoLocateHttpBinding As New GeoLocateHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/GeoLocate"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        geoLocateHttpBinding.Url = baseURL
        geoLocateHttpBinding.Credentials = credential
        Return geoLocateHttpBinding
    End Function

    Public Shared Function getInvokePaceConnectHttpBinding() As InvokePaceConnectHttpBinding
        Dim invokePaceConnectHttpBinding As New InvokePaceConnectHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/InvokePaceConnect"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        invokePaceConnectHttpBinding.Url = baseURL
        invokePaceConnectHttpBinding.Credentials = credential
        Return invokePaceConnectHttpBinding
    End Function

    Public Shared Function getAttachmentServiceHttpBinding() As AttachmentServiceHttpBinding
        Dim attachmentServiceHttpBinding As New AttachmentServiceHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/AttachmentService"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        attachmentServiceHttpBinding.Url = baseURL
        attachmentServiceHttpBinding.Credentials = credential
        Return attachmentServiceHttpBinding
    End Function

    Public Shared Function getVersionHttpBinding() As VersionHttpBinding
        Dim versionHttpBinding As New VersionHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/Version"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        versionHttpBinding.Url = baseURL
        versionHttpBinding.Credentials = credential
        Return versionHttpBinding
    End Function

    Public Shared Function getSystemInspectorHttpBinding() As SystemInspectorHttpBinding
        Dim systemInspectorHttpBinding As New SystemInspectorHttpBinding()
        Dim baseURL As String = "http://" + SDK.HOST + ":" + SDK.PORT.ToString() + "/rpc/company:sample/services/SystemInspector"
        Dim credential As New NetworkCredential(SDK.USERNAME, SDK.PASSWORD)
        systemInspectorHttpBinding.Url = baseURL
        systemInspectorHttpBinding.Credentials = credential
        Return systemInspectorHttpBinding
    End Function
End Class
