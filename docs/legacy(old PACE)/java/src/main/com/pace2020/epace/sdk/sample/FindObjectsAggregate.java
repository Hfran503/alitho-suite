/**
 *
 */
package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.ArrayList;
import java.util.List;

import com.pace2020.appbox.services.rpc.ArrayOfFieldDescriptor;
import com.pace2020.appbox.services.rpc.ArrayOfValueObjectDescriptor;
import com.pace2020.appbox.services.rpc.ArrayOfXPathDataSort;
import com.pace2020.appbox.services.rpc.ValueField;
import com.pace2020.appbox.services.rpc.ValueObject;
import com.pace2020.appbox.services.rpc.ValueObjectDescriptor;
import com.pace2020.appbox.services.rpc.ValueObjectsGroup;
import com.pace2020.appbox.services.rpc.XPathDataSort;
import com.pace2020.epace.sdk.util.FieldDescriptor;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author sachindr
 */
public class FindObjectsAggregate extends SecuredWSDLClient
{

    /**
     * @param args
     */
    public static void main( String[] args ) throws Exception
    {
        new FindObjectsAggregate().run();
    }

    public ValueObjectsGroup run() throws RemoteException
    {
        //create the Job ValueObjectDescriptor for first batch of 10 records
        final ValueObjectDescriptor jobDescriptor = createJobDescriptor( 0, 10 );

        // Open Job aggregate value object loader Sample
        final ValueObjectsGroup jobVOs = getFindObjectsPortType().loadValueObjects( jobDescriptor );
        printValueObjectGroupDetail( jobVOs, 0 );

        //if there are more records, print the next batch.
        //Note:- you may use this pagination feature on any level of ValueObjectDescriptors
        if( jobVOs.getTotalRecords() > 10 )
        {
            printValueObjectGroupDetail( getFindObjectsPortType().loadValueObjects( createJobDescriptor( 11, 10 ) ),
                                         0 );
        }

        return jobVOs;
    }

    private ValueObjectDescriptor createJobDescriptor( int offset, int limit )
    {
        // create the root ValueObjectDescriptor
        final ValueObjectDescriptor jobDescriptor = new ValueObjectDescriptor();
        // set descriptor properties for Job lookup
        jobDescriptor.setObjectName( "Job" );
        jobDescriptor.setOffset( offset );
        jobDescriptor.setLimit( limit );
        jobDescriptor.setXpathFilter( "adminStatus/@openJob" );
        // create fields to lookup
        final List<FieldDescriptor> jobFieldDescriptors = new ArrayList<FieldDescriptor>();
        jobFieldDescriptors.add( new FieldDescriptor( "jobId", "@job" ) );
        jobFieldDescriptors.add( new FieldDescriptor( "description", "@description" ) );
        jobFieldDescriptors.add( new FieldDescriptor( "promiseDate", "@promiseDate" ) );
        jobFieldDescriptors.add( new FieldDescriptor( "promiseTime", "@promiseTime" ) );

        // add fields to job descriptor

        final ArrayOfFieldDescriptor array = new ArrayOfFieldDescriptor();

        array.getFieldDescriptor().addAll( jobFieldDescriptors );

        jobDescriptor.setFields( array );

        // define sorts to be used
        final List<XPathDataSort> sort = new ArrayList<XPathDataSort>();

        final XPathDataSort sort1 = new XPathDataSort();

        sort1.setDescending( Boolean.FALSE );
        sort1.setXpath( "customer/@custName" );

        sort.add( sort1 );

        final XPathDataSort sort2 = new XPathDataSort();

        sort2.setDescending( Boolean.TRUE );
        sort2.setXpath( "@description" );

        sort.add( sort2 );

        final ArrayOfXPathDataSort array5 = new ArrayOfXPathDataSort();

        array5.getXPathDataSort().addAll( sort );

        jobDescriptor.setXpathSorts( array5 );

        // create the JobPart descriptor that we want to pull with the Jobs
        final ValueObjectDescriptor jobPartDescriptor = new ValueObjectDescriptor();
        jobPartDescriptor.setObjectName( "JobPart" );
        jobPartDescriptor.setOffset( 0 );
        jobPartDescriptor.setLimit( 10 );
        // xpath is relative to this object. Leave null if you do not need a filter at this level
        //The parent filter will automatically be applied for the children
        //For eg:- the below filter will always be evaluated in context of the selected Job
        jobPartDescriptor.setXpathFilter( "productionStatus/@openJob" );

        // create fields to lookup
        final List<FieldDescriptor> jobPartFieldDescriptors = new ArrayList<FieldDescriptor>();
        jobPartFieldDescriptors.add( new FieldDescriptor( "job", "@job" ) );
        jobPartFieldDescriptors.add( new FieldDescriptor( "jobPart", "@jobPart" ) );
        jobPartFieldDescriptors.add( new FieldDescriptor( "productionStatusDesc", "productionStatus/@description" ) );
        jobPartFieldDescriptors.add( new FieldDescriptor( "qtyToMfg", "@qtyToMfg" ) );
        // add fields to jobpart descriptor

        final ArrayOfFieldDescriptor array2 = new ArrayOfFieldDescriptor();

        array2.getFieldDescriptor().addAll( jobPartFieldDescriptors );

        jobPartDescriptor.setFields( array2 );

        // create the JobShipment descriptor that we want to pull with the Jobs
        final ValueObjectDescriptor jobShipmentDescriptor = new ValueObjectDescriptor();
        jobShipmentDescriptor.setObjectName( "JobShipment" );
        jobShipmentDescriptor.setOffset( 0 );
        jobShipmentDescriptor.setLimit( 10 );

        // create fields to lookup
        final List<FieldDescriptor> jobShipmentFieldDescriptors = new ArrayList<FieldDescriptor>();
        jobShipmentFieldDescriptors.add( new FieldDescriptor( "id", "@id" ) );
        jobShipmentFieldDescriptors.add( new FieldDescriptor( "job", "@job" ) );
        jobShipmentFieldDescriptors.add( new FieldDescriptor( "jobPart", "@jobPart" ) );
        jobShipmentFieldDescriptors.add( new FieldDescriptor( "Shipment Type", "shipmentType/@description" ) );
        jobShipmentFieldDescriptors.add( new FieldDescriptor( "cost", "@cost" ) );
        // add fields to jobpart descriptor
        final ArrayOfFieldDescriptor array3 = new ArrayOfFieldDescriptor();

        array3.getFieldDescriptor().addAll( jobShipmentFieldDescriptors );

        jobShipmentDescriptor.setFields( array3 );

        // set the child in the jobdescriptor

        final List<ValueObjectDescriptor> valueDescriptors = new ArrayList<ValueObjectDescriptor>();

        valueDescriptors.add( jobPartDescriptor );
        valueDescriptors.add( jobShipmentDescriptor );

        final ArrayOfValueObjectDescriptor array6 = new ArrayOfValueObjectDescriptor();

        array6.getValueObjectDescriptor().addAll( valueDescriptors );

        jobDescriptor.setXpathSorts( array5 );

        return jobDescriptor;
    }

    private void printValueObjectGroupDetail( final ValueObjectsGroup voGroup, int level )
    {
        final String padding = getPadding( level );
        System.out.println( padding + "Total " + voGroup.getObjectName() + " available " + voGroup.getTotalRecords() );
        final List<ValueObject> vos = voGroup.getValueObjects().getValueObject();
        for( ValueObject vo : vos )
        {
            final List<ValueField> fields = vo.getFields().getValueField();
            System.out.println( padding + "*** " + vo.getObjectName() + " PK:" + vo.getPrimaryKey() + " ***" );
            for( ValueField field : fields )
            {
                System.out.println( padding + vo.getObjectName() + " Field: Name=" + field.getName() + ", Type="
                                        + field.getType() + ",Value=" + field.getValue() + ", XPath= " + field
                    .getXpath() );
            }

            final List<ValueObjectsGroup> children = vo.getChildren().getValueObjectsGroup();
            for( ValueObjectsGroup child : children )
            {
                printValueObjectGroupDetail( child, level + 1 );
            }

            System.out.println( padding + "*** " + vo.getObjectName() + " PK:" + vo.getPrimaryKey() + " ***" );
        }
    }

    private String getPadding( int level )
    {
        final StringBuilder sb = new StringBuilder();
        for( int i = 0; i < level; i++ )
        {
            sb.append( "\t" );
        }
        return sb.toString();
    }
}
