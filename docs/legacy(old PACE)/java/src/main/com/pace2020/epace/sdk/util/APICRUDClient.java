package com.pace2020.epace.sdk.util;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.text.ParseException;

import com.pace2020.epace.sdk.createobject.CreateObjectPortType;
import com.pace2020.epace.sdk.readobject.ReadObjectPortType;
import com.pace2020.epace.sdk.updateobject.UpdateObjectPortType;


/**
 * @author <a href="mailto:faizanr@efi.com">faizan raza</a>
 */
public class APICRUDClient extends SecuredWSDLClient
{
    public Object createDataObject( final DataObjectWrapper dataObjectWrapper ) throws NoSuchMethodException,
        NoSuchFieldException, InstantiationException, IllegalAccessException, InvocationTargetException, ParseException
    {
        final CreateObjectPortType port = getCreateObjectPortType();

        dataObjectWrapper.updateLocalObject();

        final Method createObjectMethod =
            port.getClass().getMethod( "create" + dataObjectWrapper.getObjectType(),
                                       dataObjectWrapper.getDataObjectClass() );

        dataObjectWrapper.setDataObject( createObjectMethod.invoke( port, dataObjectWrapper.getDataObject() ) );
        return dataObjectWrapper.getDataObject();
    }

    public Object readDataObject( final DataObjectWrapper dataObjectWrapper ) throws NoSuchMethodException,
        NoSuchFieldException, InstantiationException, IllegalAccessException, InvocationTargetException, ParseException
    {
        final ReadObjectPortType port = getReadObjectPortType();

        final Method readObjectMethod =
            port.getClass().getMethod( "read" + dataObjectWrapper.getObjectType(),
                                       dataObjectWrapper.getDataObjectClass() );

        dataObjectWrapper.setDataObject( readObjectMethod.invoke( port, dataObjectWrapper.getDataObject() ) );
        return dataObjectWrapper.getDataObject();
    }

    public Object updateDataObject( final DataObjectWrapper dataObjectWrapper ) throws NoSuchMethodException,
        NoSuchFieldException, InstantiationException, IllegalAccessException, InvocationTargetException, ParseException
    {
        final UpdateObjectPortType port = getUpdateObjectPortType();

        dataObjectWrapper.updateLocalObject();

        final Method updateObjectMethod =
            port.getClass().getMethod( "update" + dataObjectWrapper.getObjectType(),
                                       dataObjectWrapper.getDataObjectClass() );

        dataObjectWrapper.setDataObject( updateObjectMethod.invoke( port, dataObjectWrapper.getDataObject() ) );
        return dataObjectWrapper.getDataObject();
    }

    public static void main( final String[] args ) throws Exception
    {
        final DataObjectWrapper obj = DataObjectWrapper.create( args );

        final APICRUDClient apiClient = new APICRUDClient();
        apiClient.readDataObject( obj );
        obj.print();

        apiClient.updateDataObject( obj );
        obj.print();
    }
}
