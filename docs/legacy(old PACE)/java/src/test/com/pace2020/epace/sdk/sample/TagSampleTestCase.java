package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.Tag;
import junit.framework.TestCase;

public class TagSampleTestCase extends TestCase
{
    public void testTagSample() throws Exception
    {
        final TagSample tagSample = new TagSample();
        final Tag tag = tagSample.createTag();
        assertNotNull( "Tag objects do not match", tag.getObjects() );
    }
}