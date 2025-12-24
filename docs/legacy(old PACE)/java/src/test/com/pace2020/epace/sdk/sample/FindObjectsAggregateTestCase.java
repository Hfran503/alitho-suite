package com.pace2020.epace.sdk.sample;

import com.pace2020.appbox.services.rpc.ValueObjectsGroup;
import junit.framework.TestCase;

public class FindObjectsAggregateTestCase extends TestCase
{

    public void testFindObjectAggregate() throws Exception
    {
        final FindObjectsAggregate findObjects = new FindObjectsAggregate();

        final ValueObjectsGroup jobVOGroup = findObjects.run();

        assertTrue( jobVOGroup.getTotalRecords() >= 0 );
    }

}
