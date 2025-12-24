package com.pace2020.epace.sdk.sample;

import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class ReadGLAccountTestCase extends TestCase
{
    public void testReadGLAccount() throws Exception
    {
        final ReadGLAccount readAcct = new ReadGLAccount( "2" );

        assertTrue( readAcct.run().getId().intValue() == 2 );
    }
}
