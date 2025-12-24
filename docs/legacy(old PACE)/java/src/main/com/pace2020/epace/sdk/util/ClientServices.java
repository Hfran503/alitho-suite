/*
 * Copyright (c) 2018, Electronics for Imaging, Inc. EFI-Pace All Rights Reserved.
 */

package com.pace2020.epace.sdk.util;

import java.net.Authenticator;
import java.net.PasswordAuthentication;
import java.util.List;
import javax.xml.ws.BindingProvider;
import javax.xml.ws.handler.Handler;

import org.apache.cxf.endpoint.Client;
import org.apache.cxf.frontend.ClientProxy;
import org.apache.cxf.transport.http.HTTPConduit;
import org.apache.cxf.transports.http.configuration.HTTPClientPolicy;

import com.pace2020.epace.sdk.attachmentservice.AttachmentServicePortType;
import com.pace2020.epace.sdk.cloneobject.CloneObject;
import com.pace2020.epace.sdk.cloneobject.CloneObjectPortType;
import com.pace2020.epace.sdk.createobject.CreateObject;
import com.pace2020.epace.sdk.createobject.CreateObjectPortType;
import com.pace2020.epace.sdk.deleteobject.DeleteObjectPortType;
import com.pace2020.epace.sdk.deleteobject.DeleteObject_Service;
import com.pace2020.epace.sdk.findobjects.FindObjectsPortType;
import com.pace2020.epace.sdk.geolocate.GeoLocate;
import com.pace2020.epace.sdk.geolocate.GeoLocatePortType;
import com.pace2020.epace.sdk.invokeaction.InvokeActionPortType;
import com.pace2020.epace.sdk.invokepaceconnect.InvokePaceConnectPortType;
import com.pace2020.epace.sdk.invokeprocess.InvokeProcessPortType;
import com.pace2020.epace.sdk.readobject.ReadObject;
import com.pace2020.epace.sdk.readobject.ReadObjectPortType;
import com.pace2020.epace.sdk.systeminspector.SystemInspectorPortType;
import com.pace2020.epace.sdk.updateobject.UpdateObject;
import com.pace2020.epace.sdk.updateobject.UpdateObjectPortType;
import com.pace2020.epace.sdk.version.VersionPortType;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public class ClientServices
{
    private static CreateObjectPortType m_createObjectPortType;
    private static ReadObjectPortType m_readObjectPortType;
    private static UpdateObjectPortType m_updateObjectPortType;
    private static CloneObjectPortType m_cloneObjectPortType;
    private static AttachmentServicePortType m_attachmentServicePortType;
    private static InvokeProcessPortType m_invokeProcessHttpPort;
    private static FindObjectsPortType m_findObjectsPortType;
    private static InvokeActionPortType m_invokeActionPortType;
    private static DeleteObjectPortType m_deleteObjectPortType;
    private static GeoLocatePortType m_geoLocateHttpPort;
    private static InvokePaceConnectPortType m_invokePaceConnectHttpPort;
    private static VersionPortType m_versionPortType;
    private static SystemInspectorPortType m_inspector;

    static
    {
        setupSecuredWSDLClient();

        m_createObjectPortType = new CreateObject().getCreateObjectHttpPort();

        setupPort( (BindingProvider)m_createObjectPortType );

        m_readObjectPortType = new ReadObject().getReadObjectHttpPort();

        setupPort( (BindingProvider)m_readObjectPortType );

        m_updateObjectPortType = new UpdateObject().getUpdateObjectHttpPort();

        setupPort( (BindingProvider)m_updateObjectPortType );

        m_cloneObjectPortType = new CloneObject().getCloneObjectHttpPort();

        setupPort( (BindingProvider)m_cloneObjectPortType );

        m_attachmentServicePortType =
            new com.pace2020.epace.sdk.attachmentservice.AttachmentService().getAttachmentServiceHttpPort();

        setupPort( (BindingProvider)m_attachmentServicePortType );

        m_invokeProcessHttpPort =
            new com.pace2020.epace.sdk.invokeprocess.InvokeProcess().getInvokeProcessHttpPort();

        setupPort( (BindingProvider)m_invokeProcessHttpPort );

        m_findObjectsPortType =
            new com.pace2020.epace.sdk.findobjects.FindObjects().getFindObjectsHttpPort();

        setupPort( (BindingProvider)m_findObjectsPortType );

        m_invokeActionPortType =
            new com.pace2020.epace.sdk.invokeaction.InvokeAction().getInvokeActionHttpPort();

        setupPort( (BindingProvider)m_invokeActionPortType );

        m_deleteObjectPortType = new DeleteObject_Service().getDeleteObjectHttpPort();

        setupPort( (BindingProvider)m_deleteObjectPortType );

        m_geoLocateHttpPort = new GeoLocate().getGeoLocateHttpPort();

        setupPort( (BindingProvider)m_geoLocateHttpPort );

        m_invokePaceConnectHttpPort =
            new com.pace2020.epace.sdk.invokepaceconnect.InvokePaceConnect_Service().getInvokePaceConnectHttpPort();

        setupPort( (BindingProvider)m_invokePaceConnectHttpPort );

        m_versionPortType = new com.pace2020.epace.sdk.version.Version().getVersionHttpPort();

        setupPort( (BindingProvider)m_versionPortType );

        m_inspector =
            new com.pace2020.epace.sdk.systeminspector.SystemInspector().getSystemInspectorHttpPort();

        setupPort( (BindingProvider)m_inspector );
    }

    public static void setupPort( final BindingProvider provider )
    {
        // auth
        final javax.xml.ws.Binding binding = ( (BindingProvider)provider ).getBinding();
        final List<Handler> handlers = binding.getHandlerChain();
        handlers.add( new JaxWSInterceptor() );
        binding.setHandlerChain( handlers );

        final Client client = ClientProxy.getClient( provider );
        final HTTPConduit conduit = (HTTPConduit)client.getConduit();
        final HTTPClientPolicy policy = new HTTPClientPolicy();
        policy.setAllowChunking( false );
        policy.setConnectionTimeout( 1000 * 60 * 30 );
        policy.setReceiveTimeout(1000 * 60 * 30 );
        conduit.setClient( policy );

        HTTPConduit http = (HTTPConduit)client.getConduit();
        http.getAuthorization().setUserName( System.getProperty( "epace.username" ) );
        http.getAuthorization().setPassword( System.getProperty( "epace.password" ) );
    }

    public static void setupSecuredWSDLClient()
    {
        System.setProperty( "org.apache.cxf.stax.maxChildElements", "100000" );

        Authenticator.setDefault( new Authenticator()
        {
            @Override
            protected PasswordAuthentication getPasswordAuthentication()
            {
                return new PasswordAuthentication( System.getProperty( "epace.username" ),
                                                   System.getProperty( "epace.password" ).toCharArray() );
            }
        } );
    }

    public static CreateObjectPortType getCreateObjectPortType()
    {
        return m_createObjectPortType;
    }

    public static  ReadObjectPortType getReadObjectPortType()
    {
        return m_readObjectPortType;
    }

    public static  UpdateObjectPortType getUpdateObjectPortType()
    {
        return m_updateObjectPortType;
    }

    public static  CloneObjectPortType getCloneObjectPortType()
    {
        return m_cloneObjectPortType;
    }

    public static  AttachmentServicePortType getAttachmentServicePortType()
    {
        return m_attachmentServicePortType;
    }

    public static  InvokeProcessPortType getInvokeProcessHttpPort()
    {
        return m_invokeProcessHttpPort;

    }

    public static  FindObjectsPortType getFindObjectsPortType()
    {
        return m_findObjectsPortType;
    }

    public static  InvokeActionPortType getInvokeActionPortType()
    {
        return m_invokeActionPortType;
    }

    public static  DeleteObjectPortType getDeleteObjectPortType()
    {
        return m_deleteObjectPortType;
    }

    public static  GeoLocatePortType getGeoLocateHttpPort()
    {
        return m_geoLocateHttpPort;
    }

    public static  InvokePaceConnectPortType getInvokePaceConnectPort()
    {
        return m_invokePaceConnectHttpPort;
    }

    public static  VersionPortType getVersionPortType()
    {
        return m_versionPortType;
    }

    public static  SystemInspectorPortType getInspector()
    {
        return m_inspector;
    }

}