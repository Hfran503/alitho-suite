/*
 * Copyright (c) 2012 Pace Systems Group, Inc. All Rights Reserved.
 */
package com.pace2020.epace.sdk.util;

import java.util.ArrayList;
import java.util.List;

import com.pace2020.appbox.services.rpc.UserDefinedField;
import com.pace2020.appbox.services.rpc.UserDefinedObject;
import com.pace2020.epace.sdk.customizationservice.CustomizationService;
import com.pace2020.epace.sdk.customizationservice.CustomizationServicePortType;


/**
 * @author faizanr This sample shows the usage of the AttachmentService api.
 */
public class CustomizationServiceClient extends SecuredWSDLClient
{
    private static final String USERDEFINED_FIELD_TAGS = "u_tags";

    private CustomizationServicePortType customizationServicePort;

    public CustomizationServiceClient()
    {
        customizationServicePort = new CustomizationService().getCustomizationServiceHttpPort();
    }

    public UserDefinedObject addUDO( final String dataObject, final String attribute )
    {
        final UserDefinedObject udo = new UserDefinedObject();

        udo.setDataObject( dataObject );
        udo.setCategory( attribute );
        udo.setSupportsAttachment( true );

        return customizationServicePort.addUserDefinedObject( udo );
    }

    public UserDefinedField addDataUDF( final String dataObject, final String attribute, final int attributeType )
    {
        final UserDefinedField udf = new UserDefinedField();
        udf.setDataObject( dataObject );
        udf.setFieldType( "Data" );
        udf.setAttribute( attribute );
        udf.setAttributeType( attributeType );
        udf.setMaxLength( -1 );
        udf.setArrayType( -1 );
        return customizationServicePort.addUserDefinedField( udf );
    }

    public UserDefinedField addCalculationUDF( final String dataObject, final String attribute,
                                               final int attributeType, final String calculation )
    {
        final UserDefinedField udf = new UserDefinedField();
        udf.setDataObject( dataObject );
        udf.setFieldType( "Calculation" );
        udf.setAttribute( attribute );
        udf.setAttributeType( attributeType );
        udf.setMaxLength( -1 );
        udf.setArrayType( -1 );
        udf.setCalculation( calculation );
        return customizationServicePort.addUserDefinedField( udf );
    }

    public CustomizationServicePortType getServicePort()
    {
        return customizationServicePort;
    }

    public void duplicateUDO( UserDefinedObject udo, final String newUDOName )
    {
        final List<UserDefinedField> udfs =
            customizationServicePort.getUserDefinedFields( udo.getDataObject() ).getUserDefinedField();

        udo.setDataObject( newUDOName );
        udo = customizationServicePort.addUserDefinedObject( udo );

        final List<UserDefinedField> calcUDFs = new ArrayList<UserDefinedField>();
        for( UserDefinedField udf : udfs )
        {
            if( "Calculation".equals( udf.getFieldType() ) )
            {
                calcUDFs.add( udf );
            }
            else if( !udf.isPrimaryKey() && !udf.getAttribute()
                .equals( USERDEFINED_FIELD_TAGS ) ) //ToDo: we should expose a can duplicate method
            {
                udf.setDataObject( newUDOName );
                customizationServicePort.addUserDefinedField( udf );
            }
        }

        for( final UserDefinedField udf : calcUDFs )
        {
            udf.setDataObject( newUDOName );
            customizationServicePort.addUserDefinedField( udf );
        }
    }

    public static void main( String[] args )
    {
        final CustomizationServiceClient client = new CustomizationServiceClient();

        final UserDefinedObject sampleUDO = client.addUDO( "UDO_SampleUDO", "General" );
        client.addDataUDF( sampleUDO.getDataObject(), "active", 4 );
        client.addCalculationUDF( sampleUDO.getDataObject(), "inactive", 4, "not(@active)" );
        client.duplicateUDO( sampleUDO, "UDO_SampleUDO_Version2" );
    }
}
