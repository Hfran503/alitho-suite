package com.pace2020.epace.sdk.sample;

import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class InvokeProcessTestCase extends TestCase
{
    public void testInvokeProcess() throws Exception
    {
        final InvokeProcess process = new InvokeProcess();
        final boolean run = process.run();

        assertTrue( run );
    }
}
