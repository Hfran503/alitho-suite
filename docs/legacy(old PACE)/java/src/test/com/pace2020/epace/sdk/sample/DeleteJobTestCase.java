package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.Job;
import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class DeleteJobTestCase extends TestCase
{
    public void testDeleteJob() throws Exception
    {
        //create job
        final DeleteJob deleteJob = new DeleteJob( "HOUSE", "12" );

        final Job job = deleteJob.run();

        assertTrue( null == job );
    }
}