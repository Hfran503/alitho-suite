package com.pace2020.epace.sdk;

import com.pace2020.epace.object.Customer;

public class ApiTestCase extends AbstractSecuredWSDLClient
{
    public void testReadCustomer() throws Exception
    {
        Customer value = new Customer();

        value.setId( "HOUSE" );

        value = getReadObjectPortType().readCustomer( value );
        System.out.println( "Customer exists, attempting to read" );

        assertEquals( "HOUSE", value.getId() );
    }
}