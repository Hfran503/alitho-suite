/*
 * Copyright (c) 2018, Electronics for Imaging, Inc. EFI-Pace All Rights Reserved.
 */

package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.sdk.AbstractSecuredWSDLClient;

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class CreateTwoJobsUsingItemTemplatesAndCreateComboJobSampleTestCase extends AbstractSecuredWSDLClient
{
    public void testCreateTwoJobsUsingItemTemplatesAndCreateComboJobSample() throws Exception
    {
        //create job
        final CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample createJob = new CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample( "HOUSE", "12" );

        final Job job = createJob.run();

        assertTrue( job.getCustomer().equals( "HOUSE" ) );
    }
}