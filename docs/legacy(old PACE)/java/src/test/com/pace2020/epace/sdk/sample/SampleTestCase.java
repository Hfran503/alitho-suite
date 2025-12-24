package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.Customer;
import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class SampleTestCase extends TestCase
{
    public void testSample() throws Exception
    {
        final Sample sample = new Sample( "HOUSE" );
        final Customer cust = sample.run();

        assertTrue( cust.getCustName().equals( "Super Customer!" ) );
    }
}
