package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.Job;
import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class CloseJobTestCase extends TestCase
{
    public void testCloseJob() throws Exception
    {
        final CloseJob closeJob = new CloseJob( "test", "HOUSE" );

        final Job job = closeJob.run();

        assertTrue( job.getAdminStatus().equals( "O" ) );
    }
}