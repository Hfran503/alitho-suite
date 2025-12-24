package com.pace2020.epace.sdk.sample;

import java.util.Date;
import java.util.GregorianCalendar;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.epace.object.Customer;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:proyal@pace2020.com">peter royal</a>
 */
public class Sample extends SecuredWSDLClient
{
    private final String m_customerCode;

    public Sample( final String customerCode )
    {
        super();

        m_customerCode = customerCode;
    }

    public static void main( final String[] args ) throws Exception
    {
        if( args.length != 1 )
        {
            throw new Exception( "Usage: Sample <CUSTCODE>" );
        }
        else
        {
            final Sample sample = new Sample( args[0] );

            sample.run();
        }
    }

    public Customer run() throws DatatypeConfigurationException
    {

        System.out.println( "epace version: " + getVersionPortType().getVersion() );

        Customer customer = new Customer();

        customer.setCustName( "SDK Sample Customer" );

        final GregorianCalendar gc = new GregorianCalendar();

        gc.setTime( new Date() );

        customer.setDateSetup( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );

        System.out.println( "New customer has date setup: " + customer.getDateSetup() );

        customer = getCreateObjectPortType().createCustomer( customer );

        //See how the default was populated?
        System.out.println( "Created customer '"
                                + customer.getCustName()
                                + "' on "
                                + customer.getDateSetup() );

        customer.setCustName( "Super Customer!" );

        getUpdateObjectPortType().updateCustomer( customer );

        System.out.println( "Sent name change request" );

        customer = getReadObjectPortType().readCustomer( customer );

        System.out.println( "Read shows changed name: '" + customer.getCustName() );

        getDeleteObjectPortType().deleteObject( "Customer", customer.getId() );

        System.out.println( "Customer deleted" );

        try
        {
            getReadObjectPortType().readCustomer( customer );

            throw new RuntimeException( "Customer was not deleted" ); // Should not be reached
        }
        catch( Exception e )
        {
            System.out.println( "Attempting to read again shows customer is now gone" );
        }

        // Test adding a SalesTax with a Rate lower than 1
        /*BigDecimal taxRate = new BigDecimal("0.05");
        SalesTax sT = new SalesTax();

        sT.setId("TESTXX");
        sT.setRate1(taxRate);        
        sT.setTaxNum("TXX");
        sT.setName("TESTXX");
        sT.setSalesCategory(new Integer(95));
        sT.setActive(new Boolean(true));

        sT = createObjectPortType.createSalesTax(sT); */

        return customer;
    }
}
