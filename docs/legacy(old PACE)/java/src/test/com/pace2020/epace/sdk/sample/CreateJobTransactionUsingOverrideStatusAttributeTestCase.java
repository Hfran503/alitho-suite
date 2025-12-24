package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.JobCost;
import junit.framework.TestCase;

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class CreateJobTransactionUsingOverrideStatusAttributeTestCase extends TestCase
{
    public void testCreateJobTransactionUsingOverrideStatusAttribute() throws Exception
    {
        final CreateJobTransactionUsingOverrideStatusAttribute clazz =
            new CreateJobTransactionUsingOverrideStatusAttribute( "test", "HOUSE" );

        final JobCost action = clazz.run();

        assertTrue( null != action );
    }
}