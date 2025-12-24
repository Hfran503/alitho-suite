package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.Job;
import junit.framework.TestCase;

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class FindLastMoveOnlyTransactionTestCase extends TestCase
{
    public void testCloseJob() throws Exception
    {
        final FindLastMoveOnlyTransaction findLastMoveOnlyTransaction =
            new FindLastMoveOnlyTransaction( "test", "HOUSE" );

        final Job job = findLastMoveOnlyTransaction.run();

        assertTrue( null != job );
    }
}