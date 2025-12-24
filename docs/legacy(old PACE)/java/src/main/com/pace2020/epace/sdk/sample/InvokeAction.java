/*
 * Copyright (c) 2005 Your Corporation. All Rights Reserved.
 */
package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.ArrayList;
import java.util.List;

import com.pace2020.appbox.services.rpc.ArrayOfFieldDescriptor;
import com.pace2020.appbox.services.rpc.ValueField;
import com.pace2020.appbox.services.rpc.ValueObject;
import com.pace2020.appbox.services.rpc.ValueObjectDescriptor;
import com.pace2020.appbox.services.rpc.ValueObjectsGroup;
import com.pace2020.epace.object.Quote;
import com.pace2020.epace.sdk.util.FieldDescriptor;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;


public class InvokeAction extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameters passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: InvokeAction <id>" );
        }
        else
        {
            final InvokeAction invokeAction = new InvokeAction();
            invokeAction.calculateQuote( Integer.parseInt( args[0] ) );
        }
    }

    public boolean calculateQuote( final int quoteId ) throws RemoteException
    {
        Quote quote = new Quote();
        quote.setId( quoteId );

        final Quote calculatedQuote = getInvokeActionPortType().calculateQuote( quote );

        //create the Job ValueObjectDescriptor for first batch of 10 records
        final ValueObjectDescriptor quotePriceDescriptor = createQuoteDescriptor( 0, -1, calculatedQuote.getId() );

        final ValueObjectsGroup jobVOs = getFindObjectsPortType().loadValueObjects( quotePriceDescriptor );
        printValueObjectGroupDetail( jobVOs, 0 );

        return true;
    }

    private ValueObjectDescriptor createQuoteDescriptor( int offset, int limit, final int quoteId )
    {
        // create the root ValueObjectDescriptor
        final ValueObjectDescriptor quoteDescriptor = new ValueObjectDescriptor();
        //set descriptor properties for Job lookup
        quoteDescriptor.setObjectName( "Quote" );
        quoteDescriptor.setOffset( offset );
        quoteDescriptor.setLimit( limit );
        quoteDescriptor.setXpathFilter( "@id=" + quoteId );
        // create fields to lookup

        final List<com.pace2020.epace.sdk.util.FieldDescriptor> jobFieldDescriptors =
            new ArrayList<com.pace2020.epace.sdk.util.FieldDescriptor>();
        jobFieldDescriptors.add( new com.pace2020.epace.sdk.util.FieldDescriptor( "jobId", "@job" ) );
        jobFieldDescriptors.add( new com.pace2020.epace.sdk.util.FieldDescriptor( "description", "@description" ) );
        jobFieldDescriptors.add( new com.pace2020.epace.sdk.util.FieldDescriptor( "promiseDate", "@promiseDate" ) );
        jobFieldDescriptors.add( new com.pace2020.epace.sdk.util.FieldDescriptor( "promiseTime", "@promiseTime" ) );

        // add fields to job descriptor

        final ArrayOfFieldDescriptor array = new ArrayOfFieldDescriptor();

        array.getFieldDescriptor()
            .add( new FieldDescriptor( "finalPrice", "QuoteQuantity/QuotePrice[last()]/@finalPrice" ) );

        // add fields to job descriptor
        quoteDescriptor.setFields( array );

        return quoteDescriptor;
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
                                        + field.getType() + ", Value=" + field.getValue() + ", XPath= " + field
                    .getXpath() );
            }

            System.out.println( padding + "*** " + vo.getObjectName() + " PK:" + vo.getPrimaryKey() + " ***" );
            break;
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
