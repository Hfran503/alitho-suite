package com.pace2020.epace.sdk.sample;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

import org.apache.commons.codec.binary.Base64;

import com.pace2020.appbox.services.rpc.ArrayOfFieldDescriptor;
import com.pace2020.appbox.services.rpc.ArrayOfReportParameterWrapper;
import com.pace2020.appbox.services.rpc.ArrayOfValueField;
import com.pace2020.appbox.services.rpc.ArrayOfValueObject;
import com.pace2020.appbox.services.rpc.ArrayOfValueObjectDescriptor;
import com.pace2020.appbox.services.rpc.ReportParameterWrapper;
import com.pace2020.appbox.services.rpc.ReportWrapper;
import com.pace2020.appbox.services.rpc.ValueField;
import com.pace2020.appbox.services.rpc.ValueObject;
import com.pace2020.appbox.services.rpc.ValueObjectDescriptor;
import com.pace2020.appbox.services.rpc.ValueObjectsGroup;
import com.pace2020.epace.sdk.findobjects.FindObjects;
import com.pace2020.epace.sdk.findobjects.FindObjectsPortType;
import com.pace2020.epace.sdk.reportservice.ReportService;
import com.pace2020.epace.sdk.reportservice.ReportServicePortType;
import com.pace2020.epace.sdk.util.FieldDescriptor;

public class ReportServiceSample
{
    private static FindObjectsPortType findObjectsPortType = new FindObjects().getFindObjectsHttpPort();

    public static void main( String[] args ) throws IOException
    {
        printReportList();

        System.out.println( "Choosing report 258 among the above list" );
        final String reportId = "258";

        final List<ValueObject> reportParametersValueObjects = getReportParameters( reportId );

        readReport( reportId, reportParametersValueObjects );
    }

    public static void printReportList()
    {
        ValueObjectDescriptor reportDescriptor = createValueObjectDescriptorForReport( "@active='true'" );

        ValueObjectsGroup valueObjectGroup = findObjectsPortType.loadValueObjects( reportDescriptor );

        System.out.println( "Total Number of active reports : " + valueObjectGroup.getTotalRecords() );

        ArrayOfValueObject arrayOfValueObject = valueObjectGroup.getValueObjects();

        final List<ValueObject> valueObjects = arrayOfValueObject.getValueObject();

        for( final ValueObject valueObject : valueObjects )
        {
            final ArrayOfValueField arrayOfValueField = valueObject.getFields();

            for( final ValueField valueField : arrayOfValueField.getValueField() )
            {
                System.out.print( "   " + valueField.getValue() + "   " );
            }
            System.out.println();
        }

    }

    private static ValueObjectDescriptor createValueObjectDescriptorForReport( final String filter )
    {
        // 1. create ValueObjectDescriptor for getting the report object.
        final ValueObjectDescriptor reportDescriptor = new ValueObjectDescriptor();
        reportDescriptor.setObjectName( "Report" );
        reportDescriptor.setXpathFilter( filter );
        reportDescriptor.setOffset( 0 );
        reportDescriptor.setLimit( 1000 );

        // 2. Create Look up fields of Report Object.
        final List<FieldDescriptor> reportFieldDescriptors = new ArrayList<FieldDescriptor>();
        reportFieldDescriptors.add( new FieldDescriptor( "id", "@id" ) );
        reportFieldDescriptors.add( new FieldDescriptor( "Name", "@displayName" ) );

        final ArrayOfFieldDescriptor array = new ArrayOfFieldDescriptor();
        array.getFieldDescriptor().addAll( reportFieldDescriptors );

        reportDescriptor.setFields( array );

        return reportDescriptor;
    }

    private static List<ValueObject> getReportParameters( final String reportId )
    {
        final ValueObjectDescriptor reportDescriptor = createValueObjectDescriptorForReport( "@id=" + reportId );

        // Create ValueObjectDescriptor for ReportParameter
        final ValueObjectDescriptor reportParameterDescriptor = new ValueObjectDescriptor();
        reportParameterDescriptor.setObjectName( "ReportParameter" );
        reportParameterDescriptor.setOffset( 0 );
        reportParameterDescriptor.setLimit( 1000 );

        // Create fields to lookup for ReportParameter Object
        final List<FieldDescriptor> reportFieldDescriptors = new ArrayList<FieldDescriptor>();

        reportFieldDescriptors.add( new FieldDescriptor( "id", "@id" ) );
        reportFieldDescriptors.add( new FieldDescriptor( "Expression Type", "@expressionType" ) );
        reportFieldDescriptors.add( new FieldDescriptor( "Expression", "@expression" ) );

        final ArrayOfFieldDescriptor arrayOfFieldDescriptor = new ArrayOfFieldDescriptor();
        arrayOfFieldDescriptor.getFieldDescriptor().addAll( reportFieldDescriptors );

        reportParameterDescriptor.setFields( arrayOfFieldDescriptor );

        final ArrayOfValueObjectDescriptor arrayOfChildren = new ArrayOfValueObjectDescriptor();
        arrayOfChildren.getValueObjectDescriptor().add( reportParameterDescriptor );
        reportDescriptor.setChildren( arrayOfChildren );

        final ValueObjectsGroup valueObjectGroup = findObjectsPortType.loadValueObjects( reportDescriptor );

        List<ValueObject> reportParameterValueObjects = null;
        // Usually there is only one record.
        if( valueObjectGroup.getValueObjects().getValueObject().size() != 0 )
        {
            ValueObject valueObject = valueObjectGroup.getValueObjects().getValueObject().get( 0 );
            final List<ValueObjectsGroup> reportParametersVOGroup = valueObject.getChildren().getValueObjectsGroup();

            if( reportParametersVOGroup.size() != 0 )
            {
                reportParameterValueObjects = reportParametersVOGroup.get( 0 ).getValueObjects().getValueObject();
                System.out.println( "   id      type      value" );
                for( final ValueObject reportParameterValueObject : reportParameterValueObjects )
                {
                    final List<ValueField> valueFields = reportParameterValueObject.getFields().getValueField();

                    for( final ValueField valueField : valueFields )
                    {
                        System.out.print( "   " + valueField.getValue() + "   " );
                    }
                    System.out.println();
                }
            }
        }
        else
        {
            System.out.println( "Entered report id doesn't exist in the system." );
        }

        return reportParameterValueObjects;
    }

    private static void readReport( final String reportId, final List<ValueObject> valueObjects ) throws IOException
    {
        //1. Create ReportWrapper
        ReportWrapper reportWrapper = new ReportWrapper();

        //2. Create Report with its id set and set it to the ReportWrapper
        reportWrapper.setReportId( reportId );

        // 3. Create ReportParameterWrapper array.
        final ArrayOfReportParameterWrapper array = new ArrayOfReportParameterWrapper();

        for( int index = 0; index < valueObjects.size(); index++ )
        {
            final ValueObject valueObject = valueObjects.get( index );
            final List<ValueField> valueFieldArray = valueObject.getFields().getValueField();

            final ReportParameterWrapper reportParameterWrapper = new ReportParameterWrapper();

            for( int i = 0; i < valueFieldArray.size(); i++ )
            {
                ValueField valueField = valueFieldArray.get( i );
                if( i == 1 )
                {
                    reportParameterWrapper.setReportParameterId( valueField.getValue() );
                }
                if( i == 2 )
                {
                    reportParameterWrapper.setValue( valueField.getValue() );
                }
            }
            array.getReportParameterWrapper().add( reportParameterWrapper );
        }

        final ReportServicePortType reportServicePortType = new ReportService().getReportServiceHttpPort();

        // 4. Read the report Or
        reportWrapper = new ReportService().getReportServiceHttpPort().executeReport( reportWrapper );

        // Print Report
        reportServicePortType.printReport( reportWrapper );

        // 5. Decode the content obtained from executeReport call.
        byte[] decoded = Base64.decodeBase64( reportWrapper.getContent().getBytes() );

        // 6. Write the content to the file.
        OutputStream outPutStream = null;
        try
        {
            outPutStream = new FileOutputStream( "abc.rtf" );
            outPutStream.write( decoded );
        }
        finally
        {
            if( null != outPutStream )
            {
                outPutStream.close();
            }
        }

        System.out.println( "Report got published successfully" );
    }

}